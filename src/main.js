// Offline Markdown Preview — hardened fork of tanabe/markdown-live-preview (MIT).
// Changes from upstream: no analytics, no external requests (enforced by CSP),
// document content is never written to browser storage, Mermaid and the
// Storehouse dependency removed, drag-and-drop open, two-way scroll sync.
import * as monaco from 'monaco-editor';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import './css/style.css';
import lightCss from './css/github-markdown-light.css?raw';
import darkCss from './css/github-markdown-dark_dimmed.css?raw';

const SETTINGS_KEY = 'offline-md-preview.settings'; // UI settings only, never content

const defaultInput = `# Offline Markdown Preview

Open a \`.md\` file, or an Unstructured.io \`.json\` output (converted automatically), with **Open**, or drag and drop it anywhere on this window.

- Runs entirely from this one file; nothing is uploaded.
- The page's Content Security Policy blocks every network request.
- Your document is held in memory only and is gone when you close the tab.

| Check | Status |
| --- | --- |
| Raw HTML tables (e.g. Unstructured \`text_as_html\`) | Rendered |
| Scripts / event handlers in content | Stripped by DOMPurify |
`;

const loadSettings = () => {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch { return {}; }
};
const saveSettings = (patch) => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...loadSettings(), ...patch })); } catch { /* ignore */ }
};

// Defence in depth on top of CSP: drop any resource URL that isn't embedded
// (data:/blob:) so the browser never even attempts an external load.
const RESOURCE_ATTRS = ['src', 'srcset', 'poster', 'background', 'data', 'action', 'formaction', 'xlink:href'];
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    for (const attr of RESOURCE_ATTRS) {
        const v = node.getAttribute && node.getAttribute(attr);
        if (v !== null && v !== undefined && !/^\s*(data|blob):/i.test(v)) node.removeAttribute(attr);
    }
});

// Unstructured.io elements JSON -> Markdown. Mirrors the team's
// elements_json_to_markdown.py: tables keep text_as_html, images become
// data: URIs, Titles become "# ", everything else is its text.
const SAFE_MIME = /^image\/[a-z0-9.+-]+$/i;
const elementsToMarkdown = (data) => {
    const elements = Array.isArray(data) ? data : data && Array.isArray(data.elements) ? data.elements : null;
    if (!elements) throw new Error('Expected a JSON array of Unstructured elements.');
    const blocks = [];
    for (const el of elements) {
        if (!el || typeof el !== 'object') continue;
        const type = el.type;
        const meta = (el.metadata && typeof el.metadata === 'object') ? el.metadata : {};
        if (type === 'Table' && meta.text_as_html) {
            blocks.push(String(meta.text_as_html));
        } else if (type === 'Image' && meta.image_base64) {
            const mime = SAFE_MIME.test(meta.image_mime_type || '') ? meta.image_mime_type : 'image/png';
            const b64 = String(meta.image_base64).replace(/[^A-Za-z0-9+/=]/g, '');
            blocks.push(`![image](data:${mime};base64,${b64})`);
        } else if (type === 'Title') {
            blocks.push(`# ${el.text ?? ''}`);
        } else {
            blocks.push(String(el.text ?? ''));
        }
    }
    return blocks.join('\n\n');
};
const looksLikeJson = (name, text) => /\.json$/i.test(name) || /^\s*[\[{]/.test(text);

const init = () => {
    const settings = loadSettings();
    let scrollBarSync = settings.sync !== false; // default on
    let hasEdited = false;
    let syncLock = null;

    // Monaco: no web workers (worker-src is blocked by CSP; markdown needs none).
    self.MonacoEnvironment = {
        getWorker() { return new Proxy({}, { get: () => () => { } }); }
    };

    const previewEl = document.querySelector('#preview');
    const outputEl = document.querySelector('#output');

    const editor = monaco.editor.create(document.querySelector('#editor'), {
        fontSize: 13,
        language: 'markdown',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        scrollbar: { vertical: 'visible', horizontal: 'visible' },
        wordWrap: 'on',
        hover: { enabled: false },
        quickSuggestions: false,
        suggestOnTriggerCharacters: false,
        folding: false,
        links: false,
    });

    // ----- render -----
    let renderTimer = null;
    const convert = (markdown) => {
        const html = marked.parse(markdown, { gfm: true });
        outputEl.innerHTML = DOMPurify.sanitize(html, {
            FORBID_TAGS: ['style', 'iframe', 'object', 'embed', 'base', 'meta', 'link'],
        });
    };
    const scheduleConvert = () => {
        clearTimeout(renderTimer);
        // Large documents: debounce so typing stays responsive.
        const delay = editor.getModel().getValueLength() > 200_000 ? 250 : 30;
        renderTimer = setTimeout(() => convert(editor.getValue()), delay);
    };

    editor.onDidChangeModelContent(() => {
        hasEdited = true;
        scheduleConvert();
    });

    // ----- two-way proportional scroll sync -----
    const ratio = (top, total, view) => (total - view > 0 ? top / (total - view) : 0);

    editor.onDidScrollChange((e) => {
        if (!scrollBarSync || syncLock === 'preview') return;
        syncLock = 'editor';
        const r = ratio(e.scrollTop, e.scrollHeight, editor.getLayoutInfo().height);
        previewEl.scrollTo(0, (previewEl.scrollHeight - previewEl.clientHeight) * r);
        requestAnimationFrame(() => { syncLock = null; });
    });

    previewEl.addEventListener('scroll', () => {
        if (!scrollBarSync || syncLock === 'editor') return;
        syncLock = 'preview';
        const r = ratio(previewEl.scrollTop, previewEl.scrollHeight, previewEl.clientHeight);
        const total = editor.getScrollHeight() - editor.getLayoutInfo().height;
        editor.setScrollTop(total * r);
        requestAnimationFrame(() => { syncLock = null; });
    });

    const syncBox = document.querySelector('#sync-scroll-checkbox');
    syncBox.checked = scrollBarSync;
    syncBox.addEventListener('change', (e) => {
        scrollBarSync = e.currentTarget.checked;
        saveSettings({ sync: scrollBarSync });
    });

    // ----- theme -----
    const ghStyle = document.createElement('style');
    ghStyle.id = 'gh-markdown-style';
    document.head.appendChild(ghStyle);

    const setTheme = (dark) => {
        document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
        ghStyle.textContent = dark ? darkCss : lightCss;
        monaco.editor.setTheme(dark ? 'vs-dark' : 'vs');
    };
    const themeBox = document.querySelector('#theme-checkbox');
    themeBox.checked = !!settings.dark;
    setTheme(!!settings.dark);
    themeBox.addEventListener('change', (e) => {
        setTheme(e.currentTarget.checked);
        saveSettings({ dark: e.currentTarget.checked });
    });

    // ----- load content -----
    const fileNameEl = document.querySelector('#file-name');
    const presetValue = (value, name = '') => {
        editor.setValue(value);
        editor.revealPosition({ lineNumber: 1, column: 1 });
        convert(value);
        previewEl.scrollTo({ top: 0 });
        fileNameEl.textContent = name;
        document.title = name ? `${name} — Markdown Preview (Offline)` : 'Markdown Preview (Offline)';
        hasEdited = false;
    };

    const openFile = async (file) => {
        if (!file) return;
        let text;
        try {
            text = await file.text();
        } catch {
            window.alert('Unable to read this file.');
            return;
        }
        if (looksLikeJson(file.name, text)) {
            try {
                presetValue(elementsToMarkdown(JSON.parse(text)), `${file.name} → Markdown`);
            } catch (err) {
                window.alert(`Could not convert this JSON: ${err.message}`);
            }
            return;
        }
        presetValue(text, file.name);
    };

    const openBtn = document.querySelector('#open-button');
    const fileInput = document.querySelector('#open-file-input');
    openBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0];
        fileInput.value = '';
        await openFile(file);
    });

    // Drag and drop anywhere on the window.
    const overlay = document.querySelector('#drop-overlay');
    let dragDepth = 0;
    const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
    window.addEventListener('dragenter', (e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        dragDepth++;
        overlay.classList.add('visible');
    }, true);
    window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); }, true);
    window.addEventListener('dragleave', (e) => {
        if (!hasFiles(e)) return;
        dragDepth = Math.max(0, dragDepth - 1);
        if (!dragDepth) overlay.classList.remove('visible');
    }, true);
    window.addEventListener('drop', (e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.stopPropagation();
        dragDepth = 0;
        overlay.classList.remove('visible');
        openFile(e.dataTransfer.files[0]);
    }, true);

    // ----- toolbar actions -----
    const copyBtn = document.querySelector('#copy-button');
    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(editor.getValue()).then(() => {
            copyBtn.textContent = 'Copied!';
            setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1000);
        }, () => { /* clipboard unavailable */ });
    });

    document.querySelector('#export-button').addEventListener('click', () => window.print());

    document.querySelector('#reset-button').addEventListener('click', () => {
        if (hasEdited && !window.confirm('Clear the editor? Unsaved edits will be lost.')) return;
        presetValue(defaultInput);
    });

    // Links in previewed content must not navigate this tab away.
    outputEl.addEventListener('click', (e) => {
        const a = e.target.closest('a[href]');
        if (a && !a.getAttribute('href').startsWith('#')) e.preventDefault();
    });

    // ----- resizable split -----
    const divider = document.getElementById('split-divider');
    const leftPane = document.getElementById('edit');
    const container = document.getElementById('container');
    let lastLeftRatio = 0.5;
    let isDragging = false;
    const applyRatio = (r) => {
        const avail = container.getBoundingClientRect().width - divider.offsetWidth;
        leftPane.style.width = avail * r + 'px';
        previewEl.style.width = avail * (1 - r) + 'px';
    };
    divider.addEventListener('mousedown', () => {
        isDragging = true;
        divider.classList.add('active');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    });
    divider.addEventListener('dblclick', () => { lastLeftRatio = 0.5; applyRatio(0.5); });
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const rect = container.getBoundingClientRect();
        const avail = rect.width - divider.offsetWidth;
        const left = Math.max(100, Math.min(e.clientX - rect.left, avail - 100));
        lastLeftRatio = left / avail;
        applyRatio(lastLeftRatio);
    });
    document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        divider.classList.remove('active');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    });
    window.addEventListener('resize', () => applyRatio(lastLeftRatio));

    presetValue(defaultInput);
};

window.addEventListener('load', init);
