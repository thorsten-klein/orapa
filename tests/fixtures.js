// Test fixture: starts V8 coverage on each page, converts to istanbul on close.
// Chromium-only — page.coverage is a Chromium API.
import { test as base, expect } from '@playwright/test';
import v8toIstanbul from 'v8-to-istanbul';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const NYC_OUT = path.join(REPO_ROOT, '.nyc_output');
const SRC_PREFIX = url.pathToFileURL(path.join(REPO_ROOT, 'src/')).href;

fs.mkdirSync(NYC_OUT, { recursive: true });

export const test = base.extend({
    page: async ({ page, browserName }, use) => {
        const supportsCoverage = browserName === 'chromium';
        if (supportsCoverage) {
            await page.coverage.startJSCoverage({ resetOnNavigation: false });
        }

        await use(page);

        if (!supportsCoverage) return;

        const entries = await page.coverage.stopJSCoverage();
        const map = {};
        for (const entry of entries) {
            if (!entry.url || !entry.url.startsWith(SRC_PREFIX)) continue;
            const filePath = url.fileURLToPath(entry.url);
            if (!fs.existsSync(filePath)) continue;
            try {
                const converter = v8toIstanbul(filePath, 0, { source: entry.source });
                await converter.load();
                converter.applyCoverage(entry.functions);
                Object.assign(map, converter.toIstanbul());
            } catch (e) {
                // Conversion failures shouldn't kill the test run.
                // Coverage gap will surface in the final report.
            }
        }
        if (Object.keys(map).length === 0) return;
        const file = path.join(NYC_OUT, `coverage-${crypto.randomBytes(8).toString('hex')}.json`);
        fs.writeFileSync(file, JSON.stringify(map));
    },
});

export { expect };

const APP_URL = url.pathToFileURL(path.join(REPO_ROOT, 'index.html')).href;

// Tiny helper to open the app and wait until it's ready. Clears localStorage
// between tests so resume / active-game state doesn't bleed across tests.
export async function openApp(page) {
    await page.goto(APP_URL);
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.goto(APP_URL);
    await page.waitForSelector('#screen-main:not(.hidden)');
}
