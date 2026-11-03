# Offline Markdown Preview

Hardened, single-file fork of [tanabe/markdown-live-preview](https://github.com/tanabe/markdown-live-preview) (MIT), the engine behind markdownlivepreview.com. Forked from commit `863cf5a`; every change is in this repo's history.

**Use:** double-click `offline-md-preview.html` (Edge/Chrome). Open or drag-drop a `.md` file, or an Unstructured.io elements `.json` file.

**Unstructured JSON:** converted to Markdown in the browser using the same rules as the team's `elements_json_to_markdown.py` (Table -> `text_as_html`, Image -> `data:` URI, Title -> `# `, else text). Output is byte-identical to the script. Image MIME type and base64 data are validated first.

## Security issues fixed vs. markdownlivepreview.com

| Issue on the hosted site / upstream code | This build |
|---|---|
| Google Analytics (`G-77C1GEG9C8`) loads on the same page as your content | Removed |
| No Content Security Policy: the page can load from and send to anywhere | CSP `default-src 'none'; connect-src 'none'; form-action 'none'`, images only from `data:`/`blob:`; no network I/O possible |
| Full document saved to browser storage on every edit (expiry 2099), reloaded on next visit | Content never stored; only theme and sync-scroll toggles |
| Outside images (`https://` `src`/`srcset`) in content load, so another server sees the request | Any non-embedded resource URL stripped before render |
| Clicking a link in the preview navigates away from the page | Outside links in the preview are blocked |
| DOMPurify 3.4.13, with published advisories | DOMPurify 3.4.17, `npm audit`: 0 vulnerabilities at build time |
| DOMPurify default settings | Additionally strips `style`, `iframe`, `object`, `embed`, `base`, `meta`, `link` |
| Hosted site's code can change at any time, silently | Frozen local file; every change is a visible commit here |
| Mermaid and a GitHub-hosted `storehouse-js` dependency | Removed |

Raw HTML in markdown (Unstructured `text_as_html` tables, `<form>` blocks) still renders. Scripts, event handlers and `javascript:` links are stripped by DOMPurify, as in upstream.

## Verify it yourself

1. Open the file, press F12, open the **Network** tab, load a document: no requests appear.
2. After downloading, check the file hash: `certutil -hashfile offline-md-preview.html SHA256` (Windows) and compare with the hash given for the current version.

## Remaining risks

Low risk and verifiable, not zero risk:

- **Browser extensions** can read any page, including this one. Managed by browser/IT policy, outside this file's control.
- **Files on disk:** input `.json`/`.md` files and exported PDFs are wherever you save them. Keep them in approved locations.
- **Clipboard:** the Copy button puts the whole document on the clipboard.
- **Page navigation** is not covered by CSP. Exploiting it would need a DOMPurify bypass plus a crafted malicious document.
- **Inline scripts are allowed** (needed for a single-file app), so blocking injected script relies on DOMPurify rather than CSP.
- **Frozen libraries:** fixes released after the build date only arrive with a rebuild. Rebuild and re-run `npm audit` periodically.
- **No independent security review yet.** Testing so far: headless Chromium on Linux with synthetic test files (script, event-handler, outside-image and iframe probes all blocked; zero network requests).

## Rebuild

```
npm ci
npm audit
npx vite build                              # -> dist/index.html
cp dist/index.html offline-md-preview.html  # replace the shipped file
```

Runtime deps: monaco-editor, marked, dompurify, github-markdown-css. Last build: 2026-11-03.
