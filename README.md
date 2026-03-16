# BF Filter

Chrome extension that filters low-value comments on the BF forum. Hides "congrats!", "+1", "W", and other fluff so you can focus on substantive discussion.

## How It Works

The extension only runs on post pages (`/posts/*`) — it does nothing on the feed, settings, or other non-post pages. It also handles SPA navigation, so clicking between threads re-processes comments automatically.

Comments are filtered through a 3-phase pipeline:

1. **Length filter** — Comments under a configurable character threshold (default: 50) are filtered instantly.
2. **Keyword filter** — Pattern matching against ~80 known fluff phrases and regex patterns (`congrats`, `amazing!`, `lfg`, `W [name]`, emoji-only posts, etc.). Also instant.
3. **AI filter (optional)** — Comments that pass the first two filters are batched into a single Claude API call for classification. One request classifies all remaining comments at once.

### Protections

- **Staff comments are never filtered** — Comments from users with a staff badge are always shown.
- **Valuable reply threads are preserved** — If a low-value comment has substantive replies underneath it, the parent comment stays visible to preserve thread context.
- **Replies to valuable comments are kept** — If a parent comment is substantive, all of its replies stay visible regardless of their individual content. This preserves conversational context.

### UI

Filtered comments are hidden and a single summary bar appears at the top of the comment list:

> **Show 7 filtered comments**

Click to reveal all filtered comments (shown dimmed with a left border accent). Click again to re-hide.

## Installation

1. Clone or download this repository
2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```
3. Open Chrome and navigate to `chrome://extensions`
4. Enable **Developer mode** (toggle in the top right)
5. Click **Load unpacked** and select the `dist/` folder
6. Navigate to any post on BF — the extension activates automatically on `/posts/*` pages

## Configuration

Click the extension icon in the Chrome toolbar to open settings:

| Setting | Description | Default |
|---|---|---|
| **Enable/Disable** | Master toggle for the extension | On |
| **Minimum Characters** | Posts under this length are filtered (0–200) | 50 |
| **Keyword patterns** | Toggle pattern-based filtering | On |
| **Minimum length** | Toggle character threshold filtering | On |
| **AI-powered (Claude)** | Toggle AI classification for comments that pass keyword/length filters | Off |

### AI Filtering Setup

1. Enable the **AI-powered (Claude)** checkbox in the popup
2. Paste your [Anthropic API key](https://console.anthropic.com/settings/keys) (`sk-ant-...`)
3. The extension uses **Claude Haiku 4.5** — fast and cheap (~$0.001 per batch of comments)

AI results are cached in `sessionStorage` so revisiting a thread doesn't re-classify comments. The cache clears when you close the tab.

## Development

```bash
# Watch mode — rebuilds on file changes
npm run dev

# Production build
npm run build
```

The built extension is output to `dist/`. After rebuilding, go to `chrome://extensions` and click the reload button on the BF Filter card.

### Project Structure

```
src/
  content.ts          — Entry point, 3-phase filter pipeline, DOM wiring
  popup.html          — Settings UI
  popup.ts            — Popup logic, reads/writes settings
  styles.css          — Summary bar and revealed-comment styles
  types.ts            — Shared TypeScript interfaces
  manifest.json       — Chrome extension manifest (V3)
  filters/
    keyword-filter.ts — Pattern/keyword matching (~80 phrases + regex)
    length-filter.ts  — Character minimum threshold
    ai-filter.ts      — Batched Claude API classification + session cache
    types.ts          — FilterStrategy interface
  dom/
    observer.ts       — MutationObserver for dynamically loaded comments
    manipulator.ts    — Hide/reveal DOM operations + summary bar
  storage/
    settings.ts       — Typed chrome.storage.sync wrapper
```

### Adding Keywords

Edit `src/filters/keyword-filter.ts`:

- **Exact matches** — Add to the `EXACT_FLUFF` set (case-insensitive, punctuation-stripped)
- **Regex patterns** — Add to the `FLUFF_PATTERNS` array

Rebuild after changes.

## Privacy

- All keyword/length filtering runs locally in your browser. No data leaves your machine.
- AI filtering (when enabled) sends comment text to the Anthropic API. Your API key is stored in `chrome.storage.sync` (synced across your Chrome devices). No data is collected or stored by this extension beyond what's needed for classification caching in your browser's `sessionStorage`.

## License

MIT — see [LICENSE](LICENSE).
