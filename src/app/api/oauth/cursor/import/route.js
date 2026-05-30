import { NextResponse } from "next/server";
import { CursorService } from "@/lib/oauth/services/cursor";
import { createProviderConnection } from "@/models";

/**
 * POST /api/oauth/cursor/import
 * Import and validate access token from Cursor IDE's local SQLite database
 *
 * Request body:
 * - accessToken: string - Access token from cursorAuth/accessToken
 * - machineId: string - Machine ID from storage.serviceMachineId
 */
export async function POST(request) {
  try {
    const payload = await request.json();
    const cursorService = new CursorService();
    const importOne = async ({ accessToken, machineId }) => {
      if (!accessToken || typeof accessToken !== "string") {
        throw new Error("Access token is required");
      }
      if (!machineId || typeof machineId !== "string") {
        throw new Error("Machine ID is required");
      }

      const tokenData = await cursorService.validateImportToken(
        accessToken.trim(),
        machineId.trim()
      );
      const userInfo = cursorService.extractUserInfo(tokenData.accessToken);
      const connection = await createProviderConnection({
        provider: "cursor",
        authType: "oauth",
        accessToken: tokenData.accessToken,
        refreshToken: null, // Cursor doesn't have public refresh endpoint
        expiresAt: new Date(Date.now() + tokenData.expiresIn * 1000).toISOString(),
        email: userInfo?.email || null,
        providerSpecificData: {
          machineId: tokenData.machineId,
          authMethod: "imported",
          provider: "Imported",
          userId: userInfo?.userId,
        },
        testStatus: "active",
      });
      return {
        id: connection.id,
        provider: connection.provider,
        email: connection.email,
      };
    };

    // Bulk import mode
    if (Array.isArray(payload?.imports)) {
      const results = [];
      for (let i = 0; i < payload.imports.length; i++) {
        const item = payload.imports[i];
        try {
          const connection = await importOne(item || {});
          results.push({ index: i, success: true, connection });
        } catch (error) {
          results.push({ index: i, success: false, error: error.message });
          if (payload?.continueOnError === false) {
            return NextResponse.json(
              {
                success: false,
                error: `Import failed at index ${i}: ${error.message}`,
                results,
              },
              { status: 400 }
            );
          }
        }
      }

      const successCount = results.filter((r) => r.success).length;
      return NextResponse.json({
        success: successCount > 0,
        mode: "bulk",
        total: results.length,
        successCount,
        failedCount: results.length - successCount,
        results,
      });
    }

    // Single import mode (backward-compatible)
    const connection = await importOne(payload || {});
    return NextResponse.json({ success: true, connection });
  } catch (error) {
    console.log("Cursor import token error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * GET /api/oauth/cursor/import
 * Get instructions for importing Cursor token
 */
export async function GET() {
  const cursorService = new CursorService();
  const instructions = cursorService.getTokenStorageInstructions();

  return NextResponse.json({
    provider: "cursor",
    method: "import_token",
    instructions,
    requiredFields: [
      {
        name: "accessToken",
        label: "Access Token",
        description: "From cursorAuth/accessToken in state.vscdb",
        type: "textarea",
      },
      {
        name: "machineId",
        label: "Machine ID",
        description: "From storage.serviceMachineId in state.vscdb",
        type: "text",
      },
    ],
    bulkImport: {
      supported: true,
      requestExample: {
        imports: [
          {
            accessToken: "<cursor_access_token_1>",
            machineId: "<machine_id_1>",
          },
          {
            accessToken: "<cursor_access_token_2>",
            machineId: "<machine_id_2>",
          },
        ],
        continueOnError: true,
      },
    },
  });
}
