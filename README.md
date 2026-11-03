# Offline Markdown Preview

Hardened, single-file fork of [tanabe/markdown-live-preview](https://github.com/tanabe/markdown-live-preview) (MIT), the engine behind markdownlivepreview.com.

**Use:** double-click `offline-md-preview.html` (Edge/Chrome). Open or drag-drop a `.md` file, or an Unstructured.io elements `.json` file.

**Unstructured JSON:** converted to Markdown in the browser using the same rules as the team's `elements_json_to_markdown.py` (Table -> `text_as_html`, Image -> `data:` URI, Title -> `# `, else text). Output is byte-identical to the script.

## What changed vs. markdownlivepreview.com
| Risk on hosted site | This build |
|---|---|
| Google Analytics script runs on the page with full DOM access | Removed |
| Pasted content saved to browser storage (expiry 2099) | Content never stored; only theme/sync toggles |
| Site can change its JS at any time | Frozen, audited local file |
| Any network access possible | CSP `default-src 'none'; connect-src 'none'` blocks all network I/O |
| External images in content would load | Non-embedded `src`/`srcset` URLs stripped before render |
| Mermaid + GitHub-hosted `storehouse-js` dependency | Removed |

Raw HTML in markdown (Unstructured `text_as_html` tables, `<form>` blocks) renders. Scripts, event handlers, iframes, `<style>` and `javascript:` links are stripped by DOMPurify.

## Verify it yourself
Open the file, press F12 > Network tab, load a document: no requests appear.

## Rebuild
```
npm ci
npx vite build     # -> dist/index.html
```
Runtime deps: monaco-editor, marked, dompurify, github-markdown-css. `npm audit`: 0 vulnerabilities at build time (2026-10-29).
