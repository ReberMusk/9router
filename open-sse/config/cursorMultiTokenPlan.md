# Cursor Multi-Token Scheduling & Bulk Import Technical Plan

## Implemented in this change
- Added bulk import support to `POST /api/oauth/cursor/import`.
- Kept single-item import backward-compatible.
- Added partial-failure tolerant mode via `continueOnError`.

## Request contract
### Single item (existing)
```json
{ "accessToken": "...", "machineId": "..." }
```

### Bulk (new)
```json
{
  "imports": [
    { "accessToken": "...", "machineId": "..." },
    { "accessToken": "...", "machineId": "..." }
  ],
  "continueOnError": true
}
```

## Response contract (bulk)
```json
{
  "success": true,
  "mode": "bulk",
  "total": 2,
  "successCount": 1,
  "failedCount": 1,
  "results": [
    { "index": 0, "success": true, "connection": { "id": "..." } },
    { "index": 1, "success": false, "error": "..." }
  ]
}
```

## Runtime scheduling design (next step)
1. Load all active `cursor` connections sorted by priority.
2. Filter out cooldown accounts (`rateLimitedUntil > now`).
3. Pick account by configured strategy:
   - `priority-fallback` (default)
   - `round-robin`
   - `sticky-round-robin`
4. On request failure, apply cooldown/backoff and retry next connection.
5. On success, reset account error state.

## Suggested configuration
- `cursorScheduler.strategy`: `priority-fallback | round-robin | sticky-round-robin`
- `cursorScheduler.stickyLimit`: integer >= 1
- `cursorScheduler.maxAttemptsPerRequest`: integer >= 1

## Minimal code touch points for scheduling
- `src/sse/services/auth.js` (or credential resolution path): switch from single credential to pool selection.
- New module: `open-sse/services/connectionScheduler.js`
  - `pickConnection(...)`
  - `markConnectionSuccess(...)`
  - `markConnectionError(...)`
- Chat flow retry integration in provider execution path.
