# Story: Offline viewer for validating Unstructured.io extraction output

| Field | Value |
|---|---|
| Issue type | Story |
| Priority | Medium |
| Labels | `unstructured`, `extraction-validation`, `security`, `tooling` |
| Story points | 3 |
| Status | In Review (built and published; awaiting approval for use on confidential documents) |

## User story

As an engineer validating Unstructured.io extraction, I want to view the output (Markdown or JSON) side by side with its rendered form in an offline tool, so that I can check extraction quality without sending confidential documents to a public website.

## Background

- **Old workflow:** Unstructured JSON → Python script → Markdown → pasted into markdownlivepreview.com.
- **Problems with that site:** it loads Google Analytics on the same page as the content, saves pasted content in browser storage until 2099, and has no network restrictions.
- **Why that matters:** not acceptable for confidential documents.

## Solution

- **What it is:** a single offline HTML file forked from the site's open-source code ([tanabe/markdown-live-preview](https://github.com/tanabe/markdown-live-preview), MIT).
- **Security changes:** analytics removed; all network access blocked by a Content Security Policy; content never stored; outside resources stripped; links blocked; libraries updated.
- **New feature:** the online viewer only opened Markdown (`.md`) files, so Unstructured JSON had to be converted with a Python script first. This version also opens Unstructured `.json` output directly and converts it to Markdown in the browser (tables, images, titles and text), with output identical to the script. That removes the conversion step. It still opens `.md` files, plus `.txt`.

## Out of scope

- Converting a whole folder at once (one file at a time).
- Checking accuracy against the source PDF.
- Audio/video transcripts.

## Acceptance criteria

1. Opens from a local file with no install and no internet connection.
2. Shows Markdown source and rendered view side by side, with sync scroll.
3. Opens an Unstructured `.json` file directly; its Markdown matches `elements_json_to_markdown.py` byte for byte.
4. HTML tables from `text_as_html` render correctly.
5. With a document loaded, the F12 Network tab shows zero requests.
6. Scripts, event handlers, outside images and iframes in content are stripped.
7. No document content is saved in browser storage.
8. README lists the security fixes, remaining risks and rebuild steps.
9. SHA256 hash of the downloaded file matches the published hash.
10. Approval obtained before use on confidential documents.

## Sub-tasks

| # | Sub-task | Status |
|---|---|---|
| 1 | Assess security of markdownlivepreview.com and alternatives (VS Code, PowerToys, Obsidian, extensions) | Done |
| 2 | Fork open-source code; remove analytics, storage and hosting code | Done |
| 3 | Add CSP network lockdown, resource stripping, link blocking; upgrade DOMPurify | Done |
| 4 | Add direct Unstructured JSON import, matching the Python script | Done |
| 5 | Test: rendering, security probes, zero network requests, parity with the script | Done |
| 6 | Publish to GitHub with hash; download into the target environment | Done |
| 7 | Write README (security fixes, remaining risks, rebuild steps) | Done |
| 8 | Add third-party licence notices for bundled libraries | To do |
| 9 | Test in the target Edge browser with a real, large document | To do |
| 10 | Get approval from the team lead / IT for use on confidential documents | In progress |

## Definition of done

- All acceptance criteria met.
- Licence notices added to the repo.
- Approval for use on confidential documents recorded.

## Risks

- **Libraries:** frozen in the file, so they need a periodic rebuild.
- **Independent review:** none yet.
- **Browser extensions and where files are saved:** outside the tool's control.
