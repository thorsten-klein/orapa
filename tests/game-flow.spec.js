// Game flow: drive the app through a full play cycle. Exercises Game, UI,
// Renderer, and InputHandler together. Uses a mix of real clicks and direct
// API calls (page.evaluate) to keep tests fast while still hitting input
// branches.
import { test, expect, openApp } from './fixtures.js';

async function startLevel(page, level) {
    await page.evaluate((lvl) => window.game.start(lvl), level);
    await page.waitForSelector('#screen-game:not(.hidden)');
}

async function placeAllSecretGemsAsPlayer(page) {
    // Copy the secret solution into the player gems list so checkSolution wins.
    await page.evaluate(() => {
        // Deep clone secret gems and assign each a player id
        gameState.playerGems = gameState.secretGems.map((g, i) => Object.assign({}, JSON.parse(JSON.stringify(g)), {
            id: `player_${i}`,
            isValid: true,
        }));
        window.game._revalidateAllPlayerGems();
        window.game.updateSolutionButtonState();
        window.game.ui.updateToolbar();
        window.game.ui.redrawAll();
    });
}

test.describe('game flow', () => {
    test.beforeEach(async ({ page }) => {
        await openApp(page);
    });

    test('Training: send waves, query, undo, redo, toggle path, info modal', async ({ page }) => {
        await startLevel(page, 'TRAINING');

        // Send a wave on the first top emitter.
        await page.evaluate(() => window.game.sendWave('T1'));
        await page.evaluate(() => window.game.sendWave('B2'));

        // Switch to query mode + back
        await page.click('#mode-query-btn');
        await page.evaluate(() => window.game.queryCell(0, 0));
        await page.evaluate(() => window.game.queryCell(0, 0)); // duplicate (alreadyHasPermanentResult branch)
        await page.evaluate(() => window.game.queryCell(99, 99)); // out of bounds
        await page.click('#mode-wave-btn');

        // Path show/hide
        await page.click('#path-hide-btn');
        await page.click('#path-show-btn');

        // Add a gem manually, then undo/redo
        await page.evaluate(() => window.game.addPlayerGem('YELLOW', 0, 0));
        await page.evaluate(() => window.game.addPlayerGem('YELLOW', 0, 0)); // duplicate (alreadyPlaced branch)
        await page.evaluate(() => window.game.addPlayerGem('BOGUS', 0, 0)); // missing def
        await page.evaluate(() => window.game.rotatePlayerGem(gameState.playerGems[0].id));
        await page.evaluate(() => {
            const g = gameState.playerGems[0];
            if (g.isFlippable) window.game.flipPlayerGem(g.id);
        });
        await page.evaluate(() => window.game.movePlayerGem(gameState.playerGems[0].id, 2, 2));
        await page.evaluate(() => window.game.movePlayerGem(gameState.playerGems[0].id, 2, 2)); // no-op
        await page.evaluate(() => window.game.movePlayerGem('bad-id', 0, 0));
        await page.evaluate(() => window.game.removePlayerGem(gameState.playerGems[0].id));
        await page.evaluate(() => window.game.removePlayerGem('bad-id'));

        // Undo/redo via buttons + keyboard
        await page.click('#btn-undo');
        await page.click('#btn-redo');
        await page.keyboard.press('Control+z');
        await page.keyboard.press('Control+y');
        await page.keyboard.press('Control+Shift+z');

        // Blocked cells
        await page.evaluate(() => window.game.toggleBlockedCell(0, 0));
        await page.evaluate(() => window.game.toggleBlockedCell(0, 0)); // unblock
        await page.evaluate(() => window.game.toggleBlockedCell(99, 99)); // oob

        // Info modal: open + close
        await page.click('#btn-info');
        await expect(page.locator('#info-modal')).not.toHaveClass(/hidden/);
        await page.keyboard.press('Escape');
        await page.click('#btn-info');
        await page.click('#btn-close-info');
        await page.click('#btn-info');
        // Click the backdrop to close
        await page.locator('#info-modal').click({ position: { x: 10, y: 10 } });

        // Logbook modal
        await page.click('#btn-history');
        await page.keyboard.press('Escape');
        await page.click('#btn-history');
        await page.click('#btn-close-logbook');
        await page.click('#btn-history');
        await page.locator('#logbook-modal').click({ position: { x: 10, y: 10 } });

        // Click a log entry (selects + dismisses on second click).
        // log-list lives inside the logbook modal — open it first.
        await page.click('#btn-history');
        const logId = await page.evaluate(() => gameState.log[0].id);
        await page.click(`#log-list li[data-log-id="${logId}"]`);
        await page.click(`#log-list li[data-log-id="${logId}"]`); // toggles off

        // Click a query log entry too
        await page.evaluate(() => window.game.setInteractionMode('query'));
        await page.evaluate(() => window.game.queryCell(1, 1));
        const queryLogId = await page.evaluate(() => gameState.log[gameState.log.length - 1].id);
        await page.click(`#log-list li[data-log-id="${queryLogId}"]`);
        await page.evaluate(() => window.game.setInteractionMode('wave'));
        await page.click('#btn-close-logbook');

        // Toggle debug mode (keyboard 'd')
        await page.keyboard.press('d');
        await page.keyboard.press('d');
    });

    test('Normal: place full secret solution, check + win', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        await placeAllSecretGemsAsPlayer(page);
        await page.click('#check-solution-btn');
        await expect(page.locator('#screen-end')).not.toHaveClass(/hidden/);
        await expect(page.locator('#end-title')).toHaveText('You Win!');

        // Download both solutions
        const [dlCorrect] = await Promise.all([
            page.waitForEvent('download'),
            page.click('#btn-download-correct'),
        ]);
        expect(dlCorrect.suggestedFilename()).toContain('correct');

        // "Play Again" same level via btn-new-level (re-renders end modal closed)
        await page.click('#btn-new-level');
        await expect(page.locator('#screen-end')).toHaveClass(/hidden/);

        // Lose this fresh game to bring up end modal again, then click btn-menu
        await page.click('#give-up-btn');
        await page.click('#btn-menu');
        await expect(page.locator('#screen-main')).not.toHaveClass(/hidden/);

        // 'n' key restart (when on main menu it should be a no-op)
        await page.keyboard.press('n');
    });

    test('Medium: lose via giveUp + download yours', async ({ page }) => {
        await startLevel(page, 'MEDIUM');

        // Add at least one player gem so the "your solution" download appears
        await page.evaluate(() => window.game.addPlayerGem('YELLOW', 0, 0));

        await page.click('#give-up-btn');
        await expect(page.locator('#end-title')).toHaveText('You Lose!');

        const [dlYours] = await Promise.all([
            page.waitForEvent('download'),
            page.click('#btn-download-yours'),
        ]);
        expect(dlYours.suggestedFilename()).toContain('your');

        // New level button
        await page.click('#btn-new-level');
        await expect(page.locator('#screen-game')).not.toHaveClass(/hidden/);
    });

    test('Hard: with an alternative solution (different gem positions)', async ({ page }) => {
        await startLevel(page, 'HARD');
        // Build a non-identical but possibly correct or incorrect solution
        // It only needs to render the "Alternative solution" path or the lose path.
        await page.evaluate(() => {
            gameState.playerGems = gameState.secretGems.map((g, i) => Object.assign({}, JSON.parse(JSON.stringify(g)), {
                id: `player_${i}`,
                isValid: true,
            }));
            // Swap two gems' positions to differ from secret (alternative-solution branch in win flow,
            // or lose branch if it produces different wave results)
            const a = gameState.playerGems[0];
            const b = gameState.playerGems[1];
            const tx = a.x, ty = a.y;
            a.x = b.x; a.y = b.y;
            b.x = tx; b.y = ty;
            window.game._revalidateAllPlayerGems();
            window.game.updateSolutionButtonState();
            window.game.ui.updateToolbar();
        });
        // Force-enable the button — we don't care if the solution is valid;
        // we want to exercise the check path either way.
        await page.evaluate(() => { window.game.ui.checkSolutionBtn.disabled = false; });
        await page.click('#check-solution-btn');
        await expect(page.locator('#screen-end')).not.toHaveClass(/hidden/);
    });
});
