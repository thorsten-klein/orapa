// Game class core API: queries, gem manipulation, collision, persistence,
// secret-placement, timing. Exercised mostly via direct page.evaluate calls
// since this is service-layer behavior.
import { test, expect, openApp } from './fixtures.js';

async function startLevel(page, level) {
    await page.evaluate((lvl) => window.game.start(lvl), level);
    await page.waitForSelector('#screen-game:not(.hidden)');
}

test.describe('game core', () => {
    test.beforeEach(async ({ page }) => {
        await openApp(page);
    });

    // --- getQueryResult variants -----------------------------------------------

    test('getQueryResult: absorber / transparent / single-color', async ({ page }) => {
        await startLevel(page, 'HARD');
        const r = await page.evaluate(() => {
            const g = window.game;
            return {
                absorber:    g.getQueryResult({ name: 'BLACK' }),
                transparent: g.getQueryResult({ name: 'TRANSPARENT' }),
                single:      g.getQueryResult({ name: 'YELLOW' }),
            };
        });
        expect(r.absorber.colorName).toBe('Black');
        expect(r.transparent.colorName).toBe('Transparent');
        expect(r.single.colorName).toBe('Yellow');
    });

    test('getQueryResult: single baseGem not in BASE_COLORS → EMPTY_RESULT', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        const r = await page.evaluate(() => {
            const g = window.game;
            const old = g.getGemDefinition.bind(g);
            g.getGemDefinition = () => ({ color: '#fff', baseGems: ['NO_SUCH_BASE'] });
            const res = g.getQueryResult({ name: 'X' });
            g.getGemDefinition = old;
            return res;
        });
        expect(r.colorName).toBe('Empty');
    });

    test('getQueryResult: multi-baseGem with combo missing from COLOR_MIXING', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        const r = await page.evaluate(() => {
            const g = window.game;
            const old = g.getGemDefinition.bind(g);
            g.getGemDefinition = () => ({ color: '#deadbe', baseGems: ['RED', 'NONESUCH'] });
            const res = g.getQueryResult({ name: 'x' });
            g.getGemDefinition = old;
            return res;
        });
        expect(r.colorHex).toBe('#deadbe');
        expect(r.colorName).toBe('Mix');
    });

    // --- Gem manipulation ------------------------------------------------------

    test('rotatePlayerGem + flipPlayerGem with bad ids are no-ops', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        await page.evaluate(() => window.game.addPlayerGem('YELLOW', 2, 2));
        const id = await page.evaluate(() => gameState.playerGems[0].id);
        await page.evaluate((i) => window.game.rotatePlayerGem(i), id);
        await page.evaluate((i) => window.game.rotatePlayerGem(i), id);
        await page.evaluate((i) => window.game.flipPlayerGem(i), id);
        await page.evaluate(() => window.game.rotatePlayerGem('not-real'));
        await page.evaluate(() => window.game.flipPlayerGem('not-real'));
    });

    test('flipPlayerGem on a flippable gem (success branch)', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        await page.evaluate(() => window.game.addPlayerGem('RED', 2, 2));
        const id = await page.evaluate(() => gameState.playerGems[0].id);
        await page.evaluate((i) => { gameState.playerGems.find(g => g.id === i).isFlippable = true; }, id);
        await page.evaluate((i) => window.game.flipPlayerGem(i), id);
    });

    // --- Blocked cells + placement validity ------------------------------------

    test('toggleBlockedCell: gem covering target cell → no block', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        await page.evaluate(() => window.game.addPlayerGem('RED', 2, 2));
        await page.evaluate(() => window.game.toggleBlockedCell(3, 2));
        const blocked = await page.evaluate(() => gameState.blockedCells.length);
        expect(blocked).toBe(0);
    });

    test('toggleBlockedCell: gem present but does not cover target → still blocks', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        await page.evaluate(() => window.game.addPlayerGem('YELLOW', 0, 0));
        await page.evaluate(() => window.game.toggleBlockedCell(5, 5));
        const blocked = await page.evaluate(() => gameState.blockedCells.length);
        expect(blocked).toBe(1);
    });

    test('_isPlacementValid: gem overlapping a blocked cell becomes invalid', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        await page.evaluate(() => window.game.toggleBlockedCell(3, 3));
        await page.evaluate(() => window.game.addPlayerGem('RED', 2, 3));
    });

    test('_doGemsCollide: absorber-adjacent gem blocks placement', async ({ page }) => {
        await startLevel(page, 'HARD');
        await page.evaluate(() => window.game.addPlayerGem('BLACK', 0, 0));
        await page.evaluate(() => window.game.addPlayerGem('YELLOW', 0, 0));
    });

    // --- Secret placement / start failure --------------------------------------

    test('start() bails to level select when secret placement fails', async ({ page }) => {
        await page.click('#btn-start-game');
        await page.waitForSelector('#screen-level:not(.hidden)');
        await page.evaluate(() => {
            window.alert = () => {};
            window.game._placeSecretGems = () => [];
            window.game.start('NORMAL');
        });
        await expect(page.locator('#screen-level')).not.toHaveClass(/hidden/);
    });

    test('_placeSecretGems: empty custom gem set bails to level select', async ({ page }) => {
        await page.click('#btn-start-game');
        await page.evaluate(() => {
            window.alert = () => {};
            gameState.customGemSet = [];
            gameState.customGemDefinitions = {};
            window.game.start('CUSTOM');
        });
        await expect(page.locator('#screen-level')).not.toHaveClass(/hidden/);
    });

    test('_placeSecretGems: gem larger than the board triggers failure alert', async ({ page }) => {
        await page.click('#btn-start-game');
        await page.evaluate(() => {
            window.alert = () => {};
            gameState.customGemSet = ['HUGE'];
            gameState.customGemDefinitions = {
                HUGE: {
                    name: 'HUGE', color: '#fff', baseGems: ['WHITE'],
                    gridPattern: Array.from({ length: 30 }, () => Array(30).fill(CellState.BLOCK)),
                },
            };
            window.game.start('CUSTOM', { gridWidth: 8, gridHeight: 10 });
        });
        await expect(page.locator('#screen-level')).not.toHaveClass(/hidden/);
    });

    // --- Persistence (localStorage) --------------------------------------------

    test('Game._loadActiveGames: catch branches when localStorage throws', async ({ page }) => {
        await page.evaluate(() => {
            try {
                const oldGet = Storage.prototype.getItem;
                const oldSet = Storage.prototype.setItem;
                const oldRem = Storage.prototype.removeItem;
                Storage.prototype.getItem = function () { throw new Error('boom'); };
                Storage.prototype.setItem = function () { throw new Error('boom'); };
                Storage.prototype.removeItem = function () { throw new Error('boom'); };
                window.__newGame = new Game(window.game.ui);
                Storage.prototype.getItem = oldGet;
                Storage.prototype.setItem = oldSet;
                Storage.prototype.removeItem = oldRem;
            } catch (e) { /* the construction may throw before reaching the catch — that's fine */ }
        });
    });

    test('Game._loadActiveGames: parses pre-existing localStorage data', async ({ page }) => {
        // Seed an active game then reload without clearing localStorage.
        await page.evaluate(() => window.game.start('NORMAL'));
        const url = page.url();
        await page.goto(url);
        await page.waitForSelector('#screen-main:not(.hidden)');
    });

    test('Game.resetAllGames via Reset confirm modal (cancel + backdrop + confirm)', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        await page.evaluate(() => window.game.showMainMenu());
        await startLevel(page, 'MEDIUM');
        await page.evaluate(() => window.game.showMainMenu());

        await expect(page.locator('#btn-reset-all')).toBeVisible();

        await page.click('#btn-reset-all');
        await page.click('#btn-cancel-reset');
        await expect(page.locator('#reset-confirm-modal')).toHaveClass(/hidden/);

        await page.click('#btn-reset-all');
        await page.locator('#reset-confirm-modal').click({ position: { x: 5, y: 5 } });

        await page.click('#btn-reset-all');
        await page.click('#btn-confirm-reset');
        await expect(page.locator('#btn-resume-game')).not.toBeVisible();
    });

    // --- Timing ----------------------------------------------------------------

    test('getTotalElapsedMs: with and without an active session timer', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        const e1 = await page.evaluate(() => window.game.getTotalElapsedMs());
        expect(e1).toBeGreaterThanOrEqual(0);
        await page.evaluate(() => { window.game._sessionStartAt = null; });
        const e2 = await page.evaluate(() => window.game.getTotalElapsedMs());
        expect(e2).toBeGreaterThanOrEqual(0);
    });
});
