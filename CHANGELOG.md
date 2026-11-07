# Changelog

## 0.1.5 — 2026-11-07

- Fix: scope paste interception to the pending question card. The document-level
  `paste` listener used to consume **every** clipboard file — including a paste into the
  normal composer while no question was pending — upload it and send it as a steering
  prompt; because `steer` wakes an idle Session, that paste started a turn immediately.
- Paste is now handled only while a pending interaction exists **and** the event target
  is inside the card's answer row. Everywhere else the plugin does nothing and DSH's own
  paste handling applies: non-image files become `@path` chips, images join the draft,
  and nothing is sent until you press Send.
- The in-card 📎 button and drag-and-drop are unchanged.

## 0.1.4 — 2026-11-06

- Curated discovery metadata: seven GitHub topics and ten npm keywords, each mapping to a
  real search intent (`dsh-plugin`, `deepseek-harness`, `ask-user-question`,
  `question-attachments`, `file-attachments`, `image-upload`, `human-in-the-loop`, plus
  `client-plugin`, `ai-agent`, `deepseek`) instead of synonym padding.

## 0.1.3 — 2026-11-06

- Sharper discovery metadata: `question-attachments`, `answer-attachments` and
  `file-attachments` keywords/topics.

## 0.1.2 — 2026-11-06

- Document installing from the DSH **Plugins → Add plugin** dialog and from the CLI
  (`dsh plugin --profile desktop add github:rxdage/dsh-plugin-question-attachments`).
- Add package keywords and repository metadata so the plugin shows up under the
  `dsh-plugin` topic.

## 0.1.1 — 2026-11-06

- Pin the attach button to the right end of the free-text answer field **inside the
  question card** (it follows the row's live rect); fall back to the floating pill only
  when no answer row is visible.
- Show sent files as left-aligned cards above the answer row (thumbnail, name, type;
  last three, then `+N`); the card grows by 50px instead of being covered, and the strip
  resets when a new question opens.
- Keep paste (`Ctrl+V`) and drag-and-drop working from both placements.

## 0.1.0 — 2026-11-06

First minimal viable build.

- `shell.overlay` chip appears only while the current Session has a pending interaction
  (question / approval card).
- Click, paste or drag a file → `ctx.fileUpload.uploadImage()` / `upload()` →
  `session.prompt([{ type: 'file', receiptId }, { type: 'text' }], 'steer')`.
- In-place upload progress and failure text; no protocol change, no patched installation.
- Verified against DeepSeek Harness `0.2.2-rc.1` on Windows Desktop.
