# Changelog

## 0.1.0 — 2026-11-06

First minimal viable build.

- `shell.overlay` chip appears only while the current Session has a pending
  interaction (question / approval card).
- Click, paste or drag a file → `ctx.fileUpload.uploadImage()` / `upload()` →
  `session.prompt([{ type: 'file', receiptId }, { type: 'text' }], 'steer')`.
- In-place upload progress and failure text; no protocol change, no patched
  installation.
- Verified against DeepSeek Harness `0.2.2-rc.1` on Windows Desktop.
