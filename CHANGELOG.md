# Changelog

## 0.1.1 — 2026-11-06

- Pin the attach button to the right end of the free-text answer field **inside
  the question card** (it follows the field's live rect while the card scrolls or
  grows); fall back to the floating pill only when no answer field is visible.
- Keep paste (`Ctrl+V`) and drag-and-drop working from both placements.

## 0.1.0 — 2026-11-06

First minimal viable build.

- `shell.overlay` chip appears only while the current Session has a pending
  interaction (question / approval card).
- Click, paste or drag a file → `ctx.fileUpload.uploadImage()` / `upload()` →
  `session.prompt([{ type: 'file', receiptId }, { type: 'text' }], 'steer')`.
- In-place upload progress and failure text; no protocol change, no patched
  installation.
- Verified against DeepSeek Harness `0.2.2-rc.1` on Windows Desktop.
