// Renderer: queries, tooltips, paths, resize variants, transparent fills.
import { test, expect, openApp } from './fixtures.js';

async function startLevel(page, level) {
    await page.evaluate((lvl) => window.game.start(lvl), level);
    await page.waitForSelector('#screen-game:not(.hidden)');
}

test.describe('renderer', () => {
    test.beforeEach(async ({ page }) => {
        await openApp(page);
    });

    // --- Permanent query fills -------------------------------------------------

    test('permanent query with no colorHex → grey fallback fill', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        await page.evaluate(() => {
            gameState.permanentQueryResults.push({ coords: { x: 5, y: 5 }, result: { colorName: 'Empty', colorHex: null } });
            window.game.ui.redrawAll();
        });
    });

    test('permanent query with transparent colorHex hits transparentFillRgba', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        await page.evaluate(() => {
            gameState.permanentQueryResults.push({
                coords: { x: 6, y: 6 },
                result: { colorName: 'Transparent', colorHex: COLORS.TRANSPARENT },
            });
            window.game.ui.redrawAll();
        });
    });

    test('permanent query on same cell as a player gem skips the fill', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        await page.evaluate(() => {
            window.game.addPlayerGem('YELLOW', 0, 0);
            gameState.permanentQueryResults.push({ coords: { x: 0, y: 0 }, result: { colorName: 'Yellow', colorHex: '#fff' } });
            window.game.ui.redrawAll();
        });
    });

    // --- Player gem rendering --------------------------------------------------

    test('drawPlayerGems: missing gemDef is skipped', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        await page.evaluate(() => {
            gameState.playerGems.push({
                id: 'bogus', name: 'NO_SUCH_GEM_DEF',
                x: 0, y: 0, rotation: 0, isFlipped: false, isFlippable: false,
                gridPattern: [[CellState.BLOCK]], isValid: false,
            });
            const oldErr = console.error; console.error = () => {};
            window.game.ui.redrawAll();
            console.error = oldErr;
        });
    });

    test('invalid+hovered gem, drag preview, query empty cell branches', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        await page.evaluate(() => window.game.addPlayerGem('YELLOW', 0, 0));
        await page.evaluate(() => window.game.addPlayerGem('RED', 0, 0)); // overlaps → invalid

        const pos = await page.evaluate(() => {
            const g = gameState.playerGems[1];
            const r = window.game.ui.renderer;
            const rect = document.getElementById('gem-canvas').getBoundingClientRect();
            const cc = r._gridToCanvasCoords(g.x, g.y);
            return { x: rect.left + cc.x + r.cellWidth / 2, y: rect.top + cc.y + r.cellHeight / 2 };
        });
        await page.mouse.move(pos.x, pos.y);
        await page.evaluate(() => window.game.sendWave('T1'));

        // Query an empty cell so a permanent-query result with no colorHex is recorded.
        await page.click('#mode-query-btn');
        const empty = await page.evaluate(() => {
            for (let y = 0; y < gameState.gridHeight; y++) {
                for (let x = 0; x < gameState.gridWidth; x++) {
                    if (!window.game.secretGemMap.get(`${y},${x}`)) return { x, y };
                }
            }
            return null;
        });
        if (empty) await page.evaluate((p) => window.game.queryCell(p.x, p.y), empty);
    });

    // --- Paths -----------------------------------------------------------------

    test('drawPath isPreview=true branch', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        await page.evaluate(() => window.game.sendWave('T1'));
        await page.evaluate(() => {
            const r = window.game.ui.renderer;
            r.drawPath(r.pathCtx, [{ x: 0, y: 0 }, { x: 1, y: 1 }], '#fff', true);
        });
    });

    // --- Tooltip placement -----------------------------------------------------

    test('tooltip without roundRect falls back to ctx.rect', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        await page.evaluate(() => {
            const ctx = window.game.ui.renderer.pathCtx;
            const orig = ctx.roundRect;
            ctx.roundRect = null;
            window.game.ui.renderer.drawTooltip(ctx, 'no-roundrect', { x: 10, y: 10, width: 20, height: 20 });
            ctx.roundRect = orig;
        });
    });

    test('tooltip placement edge cases (top/right/bottom overflow)', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        await page.evaluate(() => window.game.sendWave('T1'));
        await page.evaluate(() => {
            const r = window.game.ui.renderer;
            const ctx = r.pathCtx;
            const cw = r.gemCanvas.width / (window.devicePixelRatio || 1);
            const ch = r.gemCanvas.height / (window.devicePixelRatio || 1);
            r.drawTooltip(ctx, 'edge-case', { x: cw - 20, y: ch - 5, width: 20, height: 20 });
            r.drawTooltip(ctx, 'edge-2', { x: cw - 5, y: 0, width: 30, height: 20 });
            r.drawTooltip(ctx, 'edge-3', { x: cw / 2, y: ch / 2, width: ch * 2, height: ch * 2 });
            r.drawTooltip(ctx, 'edge-4', { x: -1000, y: -1000, width: 10, height: 10 });
        });
    });

    test('tooltip neither-above-nor-below + rectX < 0 + extra-wide right clamp', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        await page.evaluate(() => window.game.sendWave('T1'));
        await page.evaluate(() => {
            const r = window.game.ui.renderer;
            const cw = r.gemCanvas.width / (window.devicePixelRatio || 1);
            const ch = r.gemCanvas.height / (window.devicePixelRatio || 1);
            r.drawTooltip(r.pathCtx, 'must-fit-side', { x: 1, y: 1, width: cw - 2, height: ch - 2 });
            r.drawTooltip(r.pathCtx, 'neg-x', { x: -500, y: 1, width: 100, height: 10 });
            r.drawTooltip(r.pathCtx, 'big-tip-right', { x: cw + 100, y: 10, width: 10, height: 10 });
            r.drawTooltip(r.pathCtx, 'X'.repeat(500), { x: cw - 5, y: 5, width: 5, height: 5 });
        });
    });

    // --- Layout / resize -------------------------------------------------------

    test('redrawAll: early return when canvas has zero width', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        await page.evaluate(() => {
            const c = window.game.ui.renderer.gemCanvas;
            const w = c.width;
            c.width = 0;
            window.game.ui.renderer.redrawAll();
            c.width = w;
        });
    });

    test('handleResize: portrait branch via tall narrow viewport', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        await page.setViewportSize({ width: 360, height: 1200 });
        await page.evaluate(() => window.game.ui.renderer.handleResize());
        await page.setViewportSize({ width: 1400, height: 900 });
        await page.evaluate(() => window.game.ui.renderer.handleResize());
    });

    test('handleResize: no visualViewport falls back to window.innerWidth/Height', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        await page.evaluate(() => {
            const orig = window.visualViewport;
            Object.defineProperty(window, 'visualViewport', { configurable: true, value: null });
            window.game.ui.renderer.handleResize();
            Object.defineProperty(window, 'visualViewport', { configurable: true, value: orig });
        });
    });
});
