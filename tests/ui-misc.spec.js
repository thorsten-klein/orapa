// UI: screens / level-select clicks, orientation, fullscreen, popstate,
// keyboard shortcuts, end-screen rating + alternative-solution.
import { test, expect, openApp } from './fixtures.js';

async function startLevel(page, level) {
    await page.evaluate((lvl) => window.game.start(lvl), level);
    await page.waitForSelector('#screen-game:not(.hidden)');
}

test.describe('ui misc', () => {
    test.beforeEach(async ({ page }) => {
        await openApp(page);
    });

    // --- Level-select button click handlers (inline arrow functions) ---------

    test('click non-CUSTOM level button in start mode', async ({ page }) => {
        await page.click('#btn-start-game');
        await page.waitForSelector('#screen-level:not(.hidden)');
        await page.evaluate(() => {
            Array.from(document.querySelectorAll('#level-options button'))
                .find(x => x.textContent.startsWith('Normal'))
                .click();
        });
        await page.waitForSelector('#screen-game:not(.hidden)');
    });

    test('click CUSTOM level button in start mode', async ({ page }) => {
        await page.click('#btn-start-game');
        await page.waitForSelector('#screen-level:not(.hidden)');
        await page.evaluate(() => {
            Array.from(document.querySelectorAll('#level-options button'))
                .find(x => x.textContent.includes('Custom Level'))
                .click();
        });
        await page.waitForSelector('#screen-custom-creator:not(.hidden)');
    });

    test('click non-CUSTOM resume button (active game exists)', async ({ page }) => {
        await page.evaluate(() => window.game.start('NORMAL'));
        await page.evaluate(() => window.game.showMainMenu());
        await page.click('#btn-resume-game');
        await page.waitForSelector('#screen-level:not(.hidden)');
        await page.evaluate(() => {
            Array.from(document.querySelectorAll('#level-options button'))
                .find(x => x.textContent.startsWith('Normal'))
                .click();
        });
        await page.waitForSelector('#screen-game:not(.hidden)');
    });

    test('click CUSTOM resume button (active custom game exists)', async ({ page }) => {
        await page.evaluate(() => {
            gameState.customGemSet = ['CUSTOM_RED'];
            gameState.customGemDefinitions = {
                CUSTOM_RED: { name: 'CUSTOM_RED', color: '#f00', baseGems: ['RED'],
                              gridPattern: [[CellState.BLOCK]] },
            };
            window.game.start('CUSTOM');
        });
        await page.evaluate(() => window.game.showMainMenu());
        await page.click('#btn-resume-game');
        await page.evaluate(() => {
            Array.from(document.querySelectorAll('#level-options button'))
                .find(x => x.textContent.includes('Custom Level'))
                .click();
        });
        await page.waitForSelector('#screen-game:not(.hidden)');
    });

    // --- Orientation + keyboard shortcuts -------------------------------------

    test('orientation toggle + n-key restart + Escape returns to main', async ({ page }) => {
        await page.click('#btn-start-game');
        await page.waitForSelector('#screen-level:not(.hidden)');
        await page.click('#orient-portrait');
        await page.click('#orient-landscape');

        await page.evaluate(() => window.game.start('NORMAL'));
        await page.waitForSelector('#screen-game:not(.hidden)');
        await page.keyboard.press('n');
        await page.keyboard.press('Escape');
        await expect(page.locator('#screen-main')).not.toHaveClass(/hidden/);
    });

    test('log-list animationend removes flash class', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        await page.evaluate(() => {
            const list = document.getElementById('log-list');
            list.classList.add('flash');
            list.dispatchEvent(new Event('animationend'));
        });
    });

    // --- Fullscreen ------------------------------------------------------------

    test('toggleFullscreen + updateFullscreenIcon both branches (enter + exit)', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        await page.evaluate(async () => {
            document.documentElement.requestFullscreen = () => Promise.reject(new Error('blocked'));
            await window.game.ui.toggleFullscreen();
        });
        await page.evaluate(async () => {
            Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => document.body });
            document.exitFullscreen = () => Promise.resolve();
            window.game.ui.toggleFullscreen();
            window.game.ui.updateFullscreenIcon();
        });
    });

    // --- End screen + ratings --------------------------------------------------

    test('end screen with winning rating tier renders rating + legend', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        await page.evaluate(() => {
            gameState.playerGems = gameState.secretGems.map((g, i) => Object.assign({}, JSON.parse(JSON.stringify(g)), { id: `p_${i}`, isValid: true }));
            gameState.waveCount = 5;
        });
        await page.evaluate(() => window.game.checkSolution());
        await expect(page.locator('#end-rating')).toBeVisible();
        await expect(page.locator('#end-rating-legend')).toBeVisible();
    });

    test('areGemSetsIdentical: 180°-rotated absorber is treated as identical (orientation undetectable)', async ({ page }) => {
        await page.evaluate(() => window.game.start('HARD'));
        await page.waitForSelector('#screen-game:not(.hidden)');
        const r = await page.evaluate(() => {
            const ui = window.game.ui;
            const secret = [{
                name: 'BLACK', x: 3, y: 3,
                gridPattern: [[CellState.TRIANGLE_BR, CellState.TRIANGLE_BL]],   // rotation 0
            }];
            const player180 = [{
                name: 'BLACK', x: 3, y: 3,
                gridPattern: [[CellState.TRIANGLE_TR, CellState.TRIANGLE_TL]],   // rotation 180 — flipped tent
            }];
            const player90 = [{
                name: 'BLACK', x: 3, y: 3,
                gridPattern: [[CellState.TRIANGLE_BL], [CellState.TRIANGLE_TL]], // rotation 90 — different bbox
            }];
            return {
                rot180: ui.areGemSetsIdentical(secret, player180),  // same bbox → identical
                rot90:  ui.areGemSetsIdentical(secret, player90),   // different bbox → not identical
            };
        });
        expect(r.rot180).toBe(true);
        expect(r.rot90).toBe(false);
    });

    test('areGemSetsIdentical: non-absorber rotation differences are still distinguished', async ({ page }) => {
        await page.evaluate(() => window.game.start('MEDIUM'));
        await page.waitForSelector('#screen-game:not(.hidden)');
        const same = await page.evaluate(() => {
            const ui = window.game.ui;
            const secret = [{
                name: 'TRANSPARENT', x: 3, y: 3,
                gridPattern: [[CellState.TRIANGLE_BR, CellState.TRIANGLE_BL]],
            }];
            const player = [{
                name: 'TRANSPARENT', x: 3, y: 3,
                gridPattern: [[CellState.TRIANGLE_TR, CellState.TRIANGLE_TL]],
            }];
            return ui.areGemSetsIdentical(secret, player);
        });
        expect(same).toBe(false);
    });

    test('end screen "Alternative solution" branch when player differs from secret', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        await page.evaluate(() => {
            const secret = JSON.parse(JSON.stringify(gameState.secretGems));
            const player = secret.map((g, i) => Object.assign({}, g, { id: `p_${i}`, name: g.name + '_alt' }));
            window.game.ui.showEndScreen(true, 5, secret, player);
        });
        await expect(page.locator('#end-solution-label')).toContainText('Alternative solution');
    });

    test('no-level rating + waveCount > all tiers → no rating display', async ({ page }) => {
        await page.evaluate(() => {
            gameState.level = null;
            const target = document.getElementById('info-modal-rating');
            window.game.ui._renderRating(target);
            window.game.ui._renderRating(null);
        });
        await startLevel(page, 'NORMAL');
        await page.evaluate(() => {
            gameState.waveCount = 9999;
            gameState.playerGems = gameState.secretGems.map((g, i) => Object.assign({}, JSON.parse(JSON.stringify(g)), { id: `p_${i}`, isValid: true }));
            window.game.showEndScreen(true);
        });
    });

    // --- History API / popstate -----------------------------------------------

    test('popstate: level, custom-creator, game with-active, unknown, no-state', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        await page.evaluate(() => window.history.pushState({ screen: 'level' }, ''));
        await page.evaluate(() => window.history.pushState({ screen: 'custom-creator' }, ''));
        await page.goBack();
        await page.goBack();
        await page.goBack();

        await openApp(page);
        await page.evaluate(() => window.game.ui._handlePopState({ state: { screen: 'game' } }));
        await page.evaluate(() => window.game.ui._handlePopState({ state: { screen: 'something-else' } }));
        await page.evaluate(() => window.game.ui._handlePopState({ state: null }));
    });

    test('popstate to game with active game runs resume', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        await page.evaluate(() => window.game.showMainMenu());
        await page.evaluate(() => window.game.ui._handlePopState({ state: { screen: 'game' } }));
        await expect(page.locator('#screen-game')).not.toHaveClass(/hidden/);
    });

    // --- Defensive: showScreen catches history API failures --------------------

    test('showScreen with history.pushState/replaceState throwing → catch branch', async ({ page }) => {
        await page.evaluate(() => {
            window.history.pushState = () => { throw new Error('blocked'); };
            window.history.replaceState = () => { throw new Error('blocked'); };
            window.game.ui._historyInited = false;
            window.game.ui.showScreen('main');
            window.game.ui._historyInited = true;
            window.game.ui.showScreen('main');
        });
    });
});
