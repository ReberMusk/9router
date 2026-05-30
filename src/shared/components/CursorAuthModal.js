"use client";

import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Modal, Button, Input } from "@/shared/components";

/**
 * Cursor Auth Modal
 * Auto-detect and import token from Cursor IDE's local SQLite database
 */
export default function CursorAuthModal({ isOpen, onSuccess, onClose }) {
  const [importMode, setImportMode] = useState("single"); // single | bulk
  const [accessToken, setAccessToken] = useState("");
  const [machineId, setMachineId] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [continueOnError, setContinueOnError] = useState(true);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [autoDetecting, setAutoDetecting] = useState(false);
  const [autoDetected, setAutoDetected] = useState(false);
  const [windowsManual, setWindowsManual] = useState(false);

  const runAutoDetect = async () => {
    setAutoDetecting(true);
    setError(null);
    setAutoDetected(false);
    setWindowsManual(false);

    try {
      const res = await fetch("/api/oauth/cursor/auto-import");
      const data = await res.json();

      if (data.found) {
        setAccessToken(data.accessToken);
        setMachineId(data.machineId);
        setAutoDetected(true);
      } else if (data.windowsManual) {
        setWindowsManual(true);
      } else {
        setError(data.error || "Could not auto-detect tokens");
      }
    } catch (err) {
      setError("Failed to auto-detect tokens");
    } finally {
      setAutoDetecting(false);
    }
  };

  // Auto-detect tokens when modal opens
  useEffect(() => {
    if (!isOpen) return undefined;
    const timer = window.setTimeout(() => {
      runAutoDetect();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  const handleImportToken = async () => {
    if (!accessToken.trim()) {
      setError("Please enter an access token");
      return;
    }

    if (!machineId.trim()) {
      setError("Please enter a machine ID");
      return;
    }

    setImporting(true);
    setError(null);

    try {
      const res = await fetch("/api/oauth/cursor/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: accessToken.trim(),
          machineId: machineId.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Import failed");
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleBulkImport = async () => {
    const lines = bulkText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setError("Please paste at least one line in bulk format");
      return;
    }

    const imports = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length < 2 || !parts[0] || !parts[1]) {
        setError(`Line ${i + 1} is invalid. Use: accessToken,machineId`);
        return;
      }
      imports.push({ accessToken: parts[0], machineId: parts[1] });
    }

    setImporting(true);
    setError(null);

    try {
      const res = await fetch("/api/oauth/cursor/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imports, continueOnError }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Bulk import failed");
      if (!data.successCount || data.successCount < 1) {
        throw new Error("No valid tokens were imported");
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} title="Connect Cursor IDE" onClose={onClose}>
      <div className="flex flex-col gap-4">
        {/* Auto-detecting state */}
        {autoDetecting && (
          <div className="text-center py-6">
            <div className="size-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl text-primary animate-spin">
                progress_activity
              </span>
            </div>
            <h3 className="text-lg font-semibold mb-2">Auto-detecting tokens...</h3>
            <p className="text-sm text-text-muted">
              Reading from Cursor IDE database
            </p>
          </div>
        )}

        {/* Form (shown after auto-detect completes) */}
        {!autoDetecting && (
          <>
            {/* Success message if auto-detected */}
            {autoDetected && (
              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex gap-2">
                  <span className="material-symbols-outlined text-green-600 dark:text-green-400">check_circle</span>
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Tokens auto-detected from Cursor IDE successfully!
                  </p>
                </div>
              </div>
            )}

            {/* Windows manual instructions */}
            {windowsManual && (
              <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800 flex flex-col gap-2">
                <div className="flex gap-2 items-center">
                  <span className="material-symbols-outlined text-amber-600 dark:text-amber-400">info</span>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Could not read Cursor database automatically.
                  </p>
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Make sure Cursor IDE has been opened at least once, then click <strong>Retry</strong>. If the problem persists, paste your tokens manually below.
                </p>
                <Button onClick={runAutoDetect} variant="outline" fullWidth>
                  Retry
                </Button>
              </div>
            )}

            {/* Info message if not auto-detected */}
            {!autoDetected && !windowsManual && !error && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex gap-2">
                  <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">info</span>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Cursor IDE not detected. Please paste your tokens manually.
                  </p>
                </div>
              </div>
            )}

            {/* Access Token Input */}
            <div className="rounded-lg border border-border p-1 bg-surface">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setImportMode("single")}
                  className={`flex-1 rounded-md px-2 py-1 text-xs font-medium ${importMode === "single" ? "bg-primary text-white" : "text-text-muted hover:bg-black/5 dark:hover:bg-white/5"}`}
                >
                  Single
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode("bulk")}
                  className={`flex-1 rounded-md px-2 py-1 text-xs font-medium ${importMode === "bulk" ? "bg-primary text-white" : "text-text-muted hover:bg-black/5 dark:hover:bg-white/5"}`}
                >
                  Bulk
                </button>
              </div>
            </div>

            {importMode === "single" ? (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Access Token <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder="Access token will be auto-filled..."
                    rows={3}
                    className="w-full px-3 py-2 text-sm font-mono border border-border rounded-lg bg-background focus:outline-none focus:border-primary resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Machine ID <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={machineId}
                    onChange={(e) => setMachineId(e.target.value)}
                    placeholder="Machine ID will be auto-filled..."
                    className="font-mono text-sm"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Bulk Lines <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder={"One per line:\n<accessToken>,<machineId>"}
                    rows={7}
                    className="w-full px-3 py-2 text-xs font-mono border border-border rounded-lg bg-background focus:outline-none focus:border-primary resize-y"
                  />
                  <p className="mt-1 text-[11px] text-text-muted">
                    Format: accessToken,machineId (one pair per line)
                  </p>
                </div>

                <label className="flex items-center gap-2 text-xs text-text-muted">
                  <input
                    type="checkbox"
                    checked={continueOnError}
                    onChange={(e) => setContinueOnError(e.target.checked)}
                    className="size-3.5 accent-primary"
                  />
                  Continue importing when some lines are invalid
                </label>
              </>
            )}

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={importMode === "single" ? handleImportToken : handleBulkImport}
                fullWidth
                disabled={
                  importing
                  || (importMode === "single" ? (!accessToken.trim() || !machineId.trim()) : !bulkText.trim())
                }
              >
                {importing ? "Importing..." : importMode === "single" ? "Import Token" : "Bulk Import"}
              </Button>
              <Button onClick={onClose} variant="ghost" fullWidth>
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

CursorAuthModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onSuccess: PropTypes.func,
  onClose: PropTypes.func.isRequired,
};
