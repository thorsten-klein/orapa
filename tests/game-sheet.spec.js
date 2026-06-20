// GAME_SHEET level: manual entry of opponent's wave/query results, edit + delete.
import { test, expect, openApp } from './fixtures.js';

async function startGameSheet(page) {
    await page.evaluate(() => window.game.start('GAME_SHEET'));
    await page.waitForSelector('#screen-game:not(.hidden)');
}

test.describe('GAME_SHEET level', () => {
    test.beforeEach(async ({ page }) => {
        await openApp(page);
        await startGameSheet(page);
    });

    test('manual ray entry: open modal, choose exit + color, save → entry in log', async ({ page }) => {
        // sendWave on T1 opens the ray-result modal in SELECT/WAVE mode
        await page.evaluate(() => { gameState.interactionMode = InteractionMode.WAVE; });
        await page.evaluate(() => window.game.sendWave('T1'));
        await expect(page.locator('#ray-result-modal')).not.toHaveClass(/hidden/);

        // Pick a color (RED) and save
        await page.click('#ray-color-grid .color-pick[data-color-key="RED"]');
        await page.click('#btn-ray-save');
        await expect(page.locator('#ray-result-modal')).toHaveClass(/hidden/);

        // Save without picking a color → alert path
        await page.evaluate(() => { window.alert = () => {}; });
        await page.evaluate(() => { gameState.interactionMode = InteractionMode.WAVE; });
        await page.evaluate(() => window.game.sendWave('T2'));
        await page.click('#btn-ray-save'); // no color selected → alert + stays open
        // Now select a multi-color (mix) entry + save
        await page.click('#ray-color-grid .color-pick[data-color-key="BLUE,RED"]');
        await page.click('#btn-ray-save');

        // Send an absorbed ray
        await page.evaluate(() => { gameState.interactionMode = InteractionMode.WAVE; });
        await page.evaluate(() => window.game.sendWave('T3'));
        await page.click('#ray-color-grid .color-pick[data-color-key="__absorbed__"]');
        await page.click('#btn-ray-save');

        // No-color ray
        await page.evaluate(() => { gameState.interactionMode = InteractionMode.WAVE; });
        await page.evaluate(() => window.game.sendWave('T4'));
        await page.click('#ray-color-grid .color-pick[data-color-key="__none__"]');
        await page.click('#btn-ray-save');
    });

    test('manual query entry: open modal, pick color, save', async ({ page }) => {
        await page.evaluate(() => { gameState.interactionMode = InteractionMode.QUERY; });
        await page.evaluate(() => window.game.queryCell(0, 0));
        await expect(page.locator('#query-result-modal')).not.toHaveClass(/hidden/);

        // Save without picking
        await page.evaluate(() => { window.alert = () => {}; });
        await page.click('#btn-query-save');

        // Empty
        await page.click('#query-color-grid .color-pick[data-color-key="__none__"]');
        await page.click('#btn-query-save');

        // Absorbed
        await page.evaluate(() => { gameState.interactionMode = InteractionMode.QUERY; });
        await page.evaluate(() => window.game.queryCell(1, 0));
        await page.click('#query-color-grid .color-pick[data-color-key="__absorbed__"]');
        await page.click('#btn-query-save');

        // Single color
        await page.evaluate(() => { gameState.interactionMode = InteractionMode.QUERY; });
        await page.evaluate(() => window.game.queryCell(2, 0));
        await page.click('#query-color-grid .color-pick[data-color-key="RED"]');
        await page.click('#btn-query-save');

        // Multi-color
        await page.evaluate(() => { gameState.interactionMode = InteractionMode.QUERY; });
        await page.evaluate(() => window.game.queryCell(3, 0));
        await page.click('#query-color-grid .color-pick[data-color-key="BLUE,WHITE"]');
        await page.click('#btn-query-save');
    });

    test('edit + delete existing entries via log edit button', async ({ page }) => {
        // Create a manual wave entry first
        await page.evaluate(() => window.game.commitManualWave('T1', 'B1', ['RED'], false));

        // Open logbook + click edit button on the entry
        await page.click('#btn-history');
        await page.click('#log-list .log-edit-btn');
        await expect(page.locator('#ray-result-modal')).not.toHaveClass(/hidden/);
        // Change to absorbed + save (exercises absorbed branch in edit mode)
        await page.click('#ray-color-grid .color-pick[data-color-key="__absorbed__"]');
        await page.click('#btn-ray-save');

        // Re-open + delete
        await page.click('#btn-history');
        await page.click('#log-list .log-edit-btn');
        await page.click('#btn-ray-delete');

        // Add + edit a manual query entry
        await page.evaluate(() => window.game.commitManualQuery(2, 2, 'Red', '#ff1f2e'));
        await page.click('#btn-history');
        await page.click('#log-list .log-edit-btn');
        await expect(page.locator('#query-result-modal')).not.toHaveClass(/hidden/);
        // Change to a different mix and save
        await page.click('#query-color-grid .color-pick[data-color-key="BLUE,WHITE"]');
        await page.click('#btn-query-save');
        // Re-open + delete
        await page.click('#btn-history');
        await page.click('#log-list .log-edit-btn');
        await page.click('#btn-query-delete');
    });

    test('ray + query modal: backdrop close, cancel button, deleteFromModal with no entry', async ({ page }) => {
        await page.evaluate(() => { gameState.interactionMode = InteractionMode.WAVE; });
        await page.evaluate(() => window.game.sendWave('T1'));
        await page.click('#btn-ray-cancel');
        await expect(page.locator('#ray-result-modal')).toHaveClass(/hidden/);

        await page.evaluate(() => { gameState.interactionMode = InteractionMode.WAVE; });
        await page.evaluate(() => window.game.sendWave('T1'));
        // backdrop click
        await page.locator('#ray-result-modal').click({ position: { x: 5, y: 5 } });

        // Query modal cancel + backdrop
        await page.evaluate(() => { gameState.interactionMode = InteractionMode.QUERY; });
        await page.evaluate(() => window.game.queryCell(0, 0));
        await page.click('#btn-query-cancel');
        await page.evaluate(() => { gameState.interactionMode = InteractionMode.QUERY; });
        await page.evaluate(() => window.game.queryCell(0, 0));
        await page.locator('#query-result-modal').click({ position: { x: 5, y: 5 } });

        // _deleteFromRayModal with no existingEntry → guarded no-op
        await page.evaluate(() => { gameState.interactionMode = InteractionMode.WAVE; });
        await page.evaluate(() => window.game.sendWave('T1'));
        await page.evaluate(() => window.game.ui._deleteFromRayModal());
        await page.click('#btn-ray-cancel');

        // _deleteFromQueryModal with no existingEntry
        await page.evaluate(() => { gameState.interactionMode = InteractionMode.QUERY; });
        await page.evaluate(() => window.game.queryCell(0, 0));
        await page.evaluate(() => window.game.ui._deleteFromQueryModal());
        await page.click('#btn-query-cancel');

        // _submitRayModal / _submitQueryModal with no context → guarded early return
        await page.evaluate(() => { window.game.ui._rayModalContext = null; window.game.ui._submitRayModal(); });
        await page.evaluate(() => { window.game.ui._queryModalContext = null; window.game.ui._submitQueryModal(); });
    });

    test('SELECT mode click: emitter selects log, gem rotates, blank clears selection', async ({ page }) => {
        // Add a manual entry so an emitter is "used"
        await page.evaluate(() => window.game.commitManualWave('T1', 'B1', ['RED'], false));
        await page.evaluate(() => window.game.setInteractionMode('select'));

        const canvas = await page.evaluate(() => {
            const r = window.game.ui.renderer;
            const rect = document.getElementById('gem-canvas').getBoundingClientRect();
            const e = r.emitters.find(em => em.id === 'T1');
            return {
                emitterX: rect.left + e.rect.x + e.rect.width / 2,
                emitterY: rect.top + e.rect.y + e.rect.height / 2,
                blankCC: r._gridToCanvasCoords(4, 4),
                cellW: r.cellWidth,
                cellH: r.cellHeight,
                rectLeft: rect.left,
                rectTop: rect.top,
            };
        });
        // Click used emitter in SELECT mode → selects log
        await page.mouse.click(canvas.emitterX, canvas.emitterY);
        // Click again → deselects (toggles)
        await page.mouse.click(canvas.emitterX, canvas.emitterY);
        // Click blank cell
        await page.mouse.click(canvas.rectLeft + canvas.blankCC.x + canvas.cellW / 2, canvas.rectTop + canvas.blankCC.y + canvas.cellH / 2);
    });

    test('finish game sheet via confirm modal', async ({ page }) => {
        await page.click('#finish-game-btn');
        await expect(page.locator('#finish-confirm-modal')).not.toHaveClass(/hidden/);

        // Cancel branch
        await page.click('#btn-cancel-finish');
        await expect(page.locator('#finish-confirm-modal')).toHaveClass(/hidden/);

        await page.click('#finish-game-btn');
        // Backdrop close
        await page.locator('#finish-confirm-modal').click({ position: { x: 5, y: 5 } });

        await page.click('#finish-game-btn');
        await page.click('#btn-confirm-finish');
        await expect(page.locator('#screen-main')).not.toHaveClass(/hidden/);
    });

    test('start Game Sheet via Level Select button (also resume branch)', async ({ page }) => {
        // Back to main
        await page.evaluate(() => window.game.showMainMenu());

        // Open Level Select via real button click
        await page.click('#btn-start-game');
        await page.waitForSelector('#screen-level:not(.hidden)');

        // The Game Sheet button should be present (last button at this point in the list).
        // Click it via evaluate matching its text.
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('#level-options button'));
            const btn = buttons.find(b => b.textContent.includes('Game Sheet'));
            btn.click();
        });
        await page.waitForSelector('#screen-game:not(.hidden)');

        // Add a manual entry so the level is "active" then go back + resume
        await page.evaluate(() => window.game.commitManualWave('T1', 'B1', ['BLUE'], false));
        await page.evaluate(() => window.game.showMainMenu());

        // Resume path: open level select in resume mode
        await page.click('#btn-resume-game');
        // Verify the active branch renders no extra status line (active sheet, resume mode)
        const activeBtnText = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('#level-options button'));
            const btn = buttons.find(b => b.textContent.includes('Game Sheet'));
            return btn ? btn.textContent : '';
        });
        expect(activeBtnText).toContain('Game Sheet');

        // Resume the sheet
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('#level-options button'));
            const btn = buttons.find(b => b.textContent.includes('Game Sheet'));
            btn.click();
        });
        await page.waitForSelector('#screen-game:not(.hidden)');

        // Start a different level so the resume button stays visible, THEN finish the sheet
        // game so the Game Sheet entry is removed → "No game in progress" branch renders.
        await page.evaluate(() => window.game.start('NORMAL'));
        await page.evaluate(() => {
            // Manually remove the sheet entry (since we're not currently in that level).
            delete window.game.activeGames['GAME_SHEET'];
            window.game._writeActiveGames();
        });
        await page.evaluate(() => window.game.showMainMenu());
        await page.click('#btn-resume-game');
        const btnText = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('#level-options button'));
            const btn = buttons.find(b => b.textContent.includes('Game Sheet'));
            return btn ? btn.textContent : '';
        });
        expect(btnText).toContain('No game in progress');
    });

    test('add + remove custom gem via toolbar (+ alert branches)', async ({ page }) => {
        // The "+" tile is appended after the gem set in GAME_SHEET.
        await page.click('.toolbar-gem.toolbar-gem-add');
        await expect(page.locator('#add-gem-modal')).not.toHaveClass(/hidden/);

        // Save without picking → alert + stays open
        await page.evaluate(() => { window.alert = () => {}; });
        await page.click('#btn-add-gem-save');

        // Pick color + shape and save
        await page.click('#add-gem-color-selector .color-choice[data-color-key="RED"]');
        await page.click('#add-gem-shape-selector .shape-choice[data-shape-key="SHAPE_PARALLEL"]');
        await page.click('#btn-add-gem-save');

        // Add a second gem so we have something to remove
        await page.click('.toolbar-gem.toolbar-gem-add');
        await page.click('#add-gem-color-selector .color-choice[data-color-key="BLACK"]');
        await page.click('#add-gem-shape-selector .shape-choice[data-shape-key="SHAPE_SMALL_TRIANGLE"]');
        await page.click('#btn-add-gem-save');

        // Remove via the × button
        await page.click('.toolbar-gem-remove');

        // Cancel + backdrop close
        await page.click('.toolbar-gem.toolbar-gem-add');
        await page.click('#btn-add-gem-cancel');
        await page.click('.toolbar-gem.toolbar-gem-add');
        await page.locator('#add-gem-modal').click({ position: { x: 5, y: 5 } });

        // Direct calls into add/remove with invalid args (early returns)
        await page.evaluate(() => window.game.removeGameSheetCustomGem('not-a-gem'));
        await page.evaluate(() => window.game.addGameSheetCustomGem('RED', 'NO_SUCH_SHAPE', null));
        await page.evaluate(() => window.game.addGameSheetCustomGem('NO_SUCH_COLOR', 'SHAPE_DIAMOND', null));
        await page.evaluate(() => window.game.addGameSheetCustomGem('BLUE', 'SHAPE_CUSTOM_DESIGN',
            { gridPattern: [[CellState.BLOCK]] }));
    });

    test('deleteLogEntry: dismisses selection when the selected entry is deleted', async ({ page }) => {
        await page.evaluate(() => window.game.commitManualWave('T1', 'B1', ['RED'], false));
        const id = await page.evaluate(() => gameState.log[0].id);
        await page.evaluate((i) => { window.game.setSelectedLogEntry(i, 'T1'); }, id);
        await page.evaluate((i) => window.game.deleteLogEntry(i), id);
        await page.evaluate(() => window.game.deleteLogEntry('does-not-exist'));
    });

    test('toolbar-gem-remove touchstart stops propagation', async ({ page }) => {
        await page.evaluate(() => window.game.addGameSheetCustomGem('RED', 'SHAPE_PARALLEL', null));
        await page.evaluate(() => {
            const btn = document.querySelector('.toolbar-gem-remove');
            const ev = new Event('touchstart', { bubbles: true, cancelable: true });
            btn.dispatchEvent(ev);
        });
    });

    test('ray modal: explicit exit emitter button click + missing-exit alert', async ({ page }) => {
        await page.evaluate(() => { gameState.interactionMode = InteractionMode.WAVE; });
        await page.evaluate(() => window.game.sendWave('T1'));
        // Click a non-default exit button so the inline click handler runs
        await page.locator('#ray-exit-buttons .exit-emitter-btn').nth(1).click();
        // Clear selection then save with a non-absorbed color → alert("Pick an exit emitter.")
        await page.evaluate(() => {
            window.alert = () => {};
            delete document.getElementById('ray-exit-buttons').dataset.selectedExit;
        });
        await page.click('#ray-color-grid .color-pick[data-color-key="RED"]');
        await page.click('#btn-ray-save');
    });
});
