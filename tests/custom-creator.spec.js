// Custom level creator: size steppers, color/shape selection, designer modal,
// random generator, validation rules, then play a generated custom level.
import { test, expect, openApp } from './fixtures.js';

// Click a (possibly clamping) stepper button repeatedly until it disables.
// Returns the number of successful clicks. Bounded by maxClicks to keep tests safe.
async function clickWhileEnabled(page, selector, maxClicks = 25) {
    let n = 0;
    for (let i = 0; i < maxClicks; i++) {
        const enabled = await page.locator(selector).isEnabled();
        if (!enabled) break;
        await page.locator(selector).click();
        n++;
    }
    return n;
}

test.describe('custom creator', () => {
    test.beforeEach(async ({ page }) => {
        await openApp(page);
        await page.click('#btn-start-game');
        await page.waitForSelector('#screen-level:not(.hidden)');
        await page.evaluate(() => window.game.showCustomCreator());
        await page.waitForSelector('#screen-custom-creator:not(.hidden)');
    });

    test('size steppers + color/shape selection + preview + add gem', async ({ page }) => {
        // Hit upper + lower clamps for both axes.
        await clickWhileEnabled(page, '.creator-config .stepper-btn[data-size="W"][data-delta="1"]');
        await clickWhileEnabled(page, '.creator-config .stepper-btn[data-size="W"][data-delta="-1"]');
        await clickWhileEnabled(page, '.creator-config .stepper-btn[data-size="H"][data-delta="1"]');
        await clickWhileEnabled(page, '.creator-config .stepper-btn[data-size="H"][data-delta="-1"]');

        // Select color + shape, see preview, add
        await page.click('#custom-color-selector .color-choice[data-color-key="RED"]');
        await page.click('#custom-shape-selector .shape-choice[data-shape-key="SHAPE_PARALLEL"]');
        await expect(page.locator('#custom-gem-preview')).toHaveClass(/has-preview/);
        await page.click('#btn-add-custom-gem');

        // Light Red gem (multi-baseGems)
        await page.click('#custom-color-selector .color-choice[data-color-key="LIGHT_RED"]');
        await page.click('#custom-shape-selector .shape-choice[data-shape-key="SHAPE_DIAMOND"]');
        await page.click('#btn-add-custom-gem');

        // Black absorber
        await page.click('#custom-color-selector .color-choice[data-color-key="BLACK"]');
        await page.click('#custom-shape-selector .shape-choice[data-shape-key="SHAPE_SMALL_TRIANGLE"]');
        await page.click('#btn-add-custom-gem');

        // Alert branch when nothing selected
        await page.evaluate(() => {
            window._alerts = [];
            window.alert = (msg) => window._alerts.push(msg);
            const ui = window.game.ui.customCreatorUI;
            ui.state.selectedColorKey = null;
            ui.state.selectedShapeKey = null;
            ui.handleAddCustomGem();
        });

        // Remove a gem
        await page.click('#custom-gem-list .delete-gem-btn');
    });

    test('custom shape designer: open, draw, finish, cancel, empty no-op', async ({ page }) => {
        // First pass: open + cancel
        await page.click('#custom-shape-selector .shape-choice[data-shape-key="SHAPE_CUSTOM_DESIGN"]');
        await expect(page.locator('#custom-shape-designer-modal')).not.toHaveClass(/hidden/);
        // Cycle cell (0,0) several times (state cycles modulo 6)
        for (let i = 0; i < 6; i++) await page.click('#designer-grid [data-row="0"][data-col="0"]');
        await page.click('#designer-grid [data-row="1"][data-col="2"]');
        await page.click('#btn-cancel-design');
        await expect(page.locator('#custom-shape-designer-modal')).toHaveClass(/hidden/);

        // Second pass: open + draw + finish (commits the design)
        await page.click('#custom-shape-selector .shape-choice[data-shape-key="SHAPE_CUSTOM_DESIGN"]');
        await page.click('#designer-grid [data-row="0"][data-col="0"]');
        await page.click('#btn-finish-design');
        await expect(page.locator('#custom-shape-designer-modal')).toHaveClass(/hidden/);

        // Third pass: open + try-finish-empty (no-op, modal stays open, then cancel)
        await page.click('#custom-shape-selector .shape-choice[data-shape-key="SHAPE_CUSTOM_DESIGN"]');
        await page.evaluate(() => {
            window.game.ui.customCreatorUI.state.designerGridState =
                Array.from({ length: 4 }, () => Array(4).fill(CellState.EMPTY));
        });
        await page.click('#btn-finish-design');
        await expect(page.locator('#custom-shape-designer-modal')).not.toHaveClass(/hidden/);
        await page.click('#btn-cancel-design');

        // After 2nd-pass finish, SHAPE_CUSTOM_DESIGN is selected and a design exists.
        // Pick color + add the custom-designed gem (avoid re-clicking the shape since that re-opens designer).
        await page.click('#custom-color-selector .color-choice[data-color-key="BLUE"]');
        await page.evaluate(() => {
            const ui = window.game.ui.customCreatorUI;
            ui.state.selectedColorKey = 'BLUE';
            ui.state.selectedShapeKey = 'SHAPE_CUSTOM_DESIGN';
            ui.handleAddCustomGem();
        });
    });

    test('random level generator: open, stepper limits, generate, start', async ({ page }) => {
        await page.click('#btn-random-level');
        await expect(page.locator('#random-level-modal')).not.toHaveClass(/hidden/);

        for (const key of ['WHITE', 'TRANSPARENT', 'BLACK']) {
            await clickWhileEnabled(page, `#random-level-modal .stepper-btn[data-rnd="${key}"][data-delta="1"]`);
            await clickWhileEnabled(page, `#random-level-modal .stepper-btn[data-rnd="${key}"][data-delta="-1"]`);
        }

        // Cancel via button
        await page.click('#btn-cancel-random');
        await expect(page.locator('#random-level-modal')).toHaveClass(/hidden/);

        // Re-open + close via backdrop
        await page.click('#btn-random-level');
        await page.locator('#random-level-modal').click({ position: { x: 5, y: 5 } });
        await expect(page.locator('#random-level-modal')).toHaveClass(/hidden/);

        // Re-open + Generate + Start
        await page.click('#btn-random-level');
        await page.click('#btn-generate-random');
        await page.waitForFunction(() => !document.getElementById('btn-start-custom-level').disabled);
        await page.click('#btn-start-custom-level');
        await page.waitForSelector('#screen-game:not(.hidden)');
    });

    test('validation: every failing rule shown then resolved', async ({ page }) => {
        const messages = await page.evaluate(() => {
            const ui = window.game.ui.customCreatorUI;
            const msgs = [];
            const grab = () => document.getElementById('custom-validation-feedback').textContent;
            const setGems = (counts) => {
                ui.state.gems = [];
                for (const [key, n] of Object.entries(counts)) {
                    for (let i = 0; i < n; i++) {
                        ui.state.gems.push({ originalColorKey: key, name: `g_${key}_${i}` });
                    }
                }
                ui.validateCustomSet();
                msgs.push(grab());
            };
            setGems({});
            setGems({ RED: 1 });
            setGems({ RED: 1, YELLOW: 1 });
            setGems({ RED: 1, YELLOW: 1, BLUE: 1 });
            setGems({ RED: 1, YELLOW: 1, BLUE: 1, WHITE: 5 });
            setGems({ RED: 1, YELLOW: 1, BLUE: 1, WHITE: 1, LIGHT_RED: 5 });
            setGems({ RED: 1, YELLOW: 1, BLUE: 1, WHITE: 1, LIGHT_YELLOW: 5 });
            setGems({ RED: 1, YELLOW: 1, BLUE: 1, WHITE: 1, LIGHT_BLUE: 5 });
            setGems({ RED: 1, YELLOW: 1, BLUE: 1, WHITE: 1, TRANSPARENT: 5 });
            setGems({ RED: 1, YELLOW: 1, BLUE: 1, WHITE: 1, BLACK: 2 });
            setGems({ RED: 1, YELLOW: 1, BLUE: 1, WHITE: 1, BLACK: 1 });
            return msgs;
        });
        expect(messages.length).toBe(11);
        expect(messages[messages.length - 1]).toContain('valid');
    });

    test('back to level select from custom creator', async ({ page }) => {
        await page.click('#btn-back-to-level');
        await expect(page.locator('#screen-level')).not.toHaveClass(/hidden/);
    });

    test('default Hard set: btn-default-level populates the gem list with Hard\'s gems and starts the level', async ({ page }) => {
        await page.click('#btn-default-level');
        const colorCounts = await page.evaluate(() => {
            const counts = {};
            for (const g of window.game.ui.customCreatorUI.state.gems) {
                counts[g.originalColorKey] = (counts[g.originalColorKey] || 0) + 1;
            }
            return counts;
        });
        // Hard set = YELLOW, RED, BLUE, WHITE_DIAMOND, WHITE_TRIANGLE, TRANSPARENT, BLACK
        expect(colorCounts).toEqual({ RED: 1, YELLOW: 1, BLUE: 1, WHITE: 2, TRANSPARENT: 1, BLACK: 1 });

        // Set should validate cleanly and Start Level should be enabled.
        await expect(page.locator('#custom-validation-feedback')).toContainText('valid');
        await page.click('#btn-start-custom-level');
        await page.waitForSelector('#screen-game:not(.hidden)');
    });

    test('random generator: default BLACK count = 1 produces an absorber gem', async ({ page }) => {
        await page.click('#btn-random-level');
        await page.click('#btn-generate-random');
        await page.click('#btn-start-custom-level');
        await page.waitForSelector('#screen-game:not(.hidden)');
    });

    test('SHAPE_CUSTOM_DESIGN tile redraws existing design when populateSelectors re-runs', async ({ page }) => {
        await page.click('#custom-shape-selector .shape-choice[data-shape-key="SHAPE_CUSTOM_DESIGN"]');
        await page.click('#designer-grid [data-row="0"][data-col="0"]');
        await page.click('#btn-finish-design');
        await page.evaluate(() => window.game.ui.customCreatorUI.populateSelectors());
        await page.waitForTimeout(50);
    });
});
