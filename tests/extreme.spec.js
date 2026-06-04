// Extreme level: paint cells with selected color, cycle shapes, color palette.
import { test, expect, openApp } from './fixtures.js';

async function startLevel(page, level) {
    await page.evaluate((lvl) => window.game.start(lvl), level);
    await page.waitForSelector('#screen-game:not(.hidden)');
}

async function canvasCenterForCell(page, x, y) {
    return page.evaluate(({ x, y }) => {
        const r = window.game.ui.renderer;
        const rect = document.getElementById('gem-canvas').getBoundingClientRect();
        const cc = r._gridToCanvasCoords(x, y);
        return { cx: rect.left + cc.x + r.cellWidth / 2, cy: rect.top + cc.y + r.cellHeight / 2 };
    }, { x, y });
}

async function emitterCenter(page, id) {
    return page.evaluate((emId) => {
        const r = window.game.ui.renderer;
        const e = r.emitters.find(em => em.id === emId);
        const rect = document.getElementById('gem-canvas').getBoundingClientRect();
        return { cx: rect.left + e.rect.x + e.rect.width / 2, cy: rect.top + e.rect.y + e.rect.height / 2 };
    }, id);
}

test.describe('extreme level', () => {
    test.beforeEach(async ({ page }) => {
        await openApp(page);
        await startLevel(page, 'EXTREME');
    });

    test('paint cells: each color, cycle triangles, remove, BLACK absorber path', async ({ page }) => {
        await expect(page.locator('#color-palette-wrapper')).toBeVisible();
        await expect(page.locator('#gem-toolbar-wrapper')).not.toBeVisible();

        // Toggle a color off/on by clicking the same swatch twice
        await page.click('#color-palette .color-choice[data-color-key="BLUE"]');
        await page.click('#color-palette .color-choice[data-color-key="BLUE"]');
        await page.click('#color-palette .color-choice[data-color-key="BLUE"]');

        // Cycle through all 5 states + removal
        for (let i = 0; i < 6; i++) await page.evaluate(() => window.game.paintCell(2, 2));

        // Out-of-bounds + no color selected → early returns
        await page.evaluate(() => window.game.paintCell(99, 99));
        await page.evaluate(() => { gameState.drawSelectedColor = null; window.game.paintCell(0, 0); });
        await page.evaluate(() => window.game.setDrawColor('BLUE'));

        // Different color replacement branch
        await page.evaluate(() => window.game.paintCell(3, 3));
        await page.evaluate(() => window.game.setDrawColor('RED'));
        await page.evaluate(() => window.game.paintCell(3, 3));

        // BLACK absorber: single cycle (ABSORB → remove)
        await page.evaluate(() => window.game.setDrawColor('BLACK'));
        await page.evaluate(() => window.game.paintCell(4, 4));
        await page.evaluate(() => window.game.paintCell(4, 4));

        // After painting, check-solution becomes enabled
        await page.evaluate(() => window.game.paintCell(0, 0));
        await expect(page.locator('#check-solution-btn')).toBeEnabled();

        // Give up to leave
        await page.click('#give-up-btn');
        await expect(page.locator('#screen-end')).not.toHaveClass(/hidden/);
        await page.click('#btn-menu');
    });

    test('canvas tap paints in extreme + emitter tap sends wave', async ({ page }) => {
        await page.evaluate(() => window.game.setDrawColor('BLUE'));

        const cell = await canvasCenterForCell(page, 2, 2);
        await page.mouse.click(cell.cx, cell.cy);

        const e = await emitterCenter(page, 'T1');
        await page.mouse.click(e.cx, e.cy);
        await page.mouse.click(e.cx, e.cy);
        await page.mouse.click(e.cx, e.cy);
    });
});
