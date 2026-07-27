# Google service account scripts

This folder contains operational scripts for managing the service account used
by Google APIs (Sheets, Vertex AI).

## `encode-service-account.js`

Encodes a `serviceAccountKey.json` file into a base64 string suitable for the
`GOOGLE_SERVICE_ACCOUNT_BASE64` environment variable.

```bash
# Default path: ./backend/serviceAccountKey.json
node backend/scripts/encode-service-account.js

# Or pass a custom path:
node backend/scripts/encode-service-account.js /path/to/your-key.json
```

**Workflow to rotate the service account:**

1. Download a new JSON key from Google Cloud Console → IAM → Service Accounts.
2. Save it locally (outside the repo) as `serviceAccountKey.json`.
3. Run the encoder script above.
4. Copy the printed base64 into your `.env`:
   ```
   GOOGLE_SERVICE_ACCOUNT_BASE64=<paste>
   ```
5. Restart the backend.
6. Delete the raw JSON file: `rm backend/serviceAccountKey.json`.
7. Add `serviceAccountKey.json` to `.gitignore` (already in `backend/.gitignore`).

## Why base64?

Encoding lets us ship credentials via the standard `dotenv` flow without
duplicating Google's complex JSON inside environment variables, and without
needing to commit a binary blob.
