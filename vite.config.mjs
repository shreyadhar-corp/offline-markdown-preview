import { viteSingleFile } from 'vite-plugin-singlefile';

// Builds everything (JS, CSS, fonts) into one self-contained dist/index.html
// that runs from file:// with no network access.
export default {
    base: './',
    plugins: [viteSingleFile({ removeViteModuleLoader: true })],
    build: {
        assetsInlineLimit: 100_000_000,
        cssCodeSplit: false,
        modulePreload: false,
        sourcemap: false,
    },
};
