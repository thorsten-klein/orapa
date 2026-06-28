// Shareable boards, BOARD_CREATION designer, Play-with-Friends modal,
// player-path preview toggle, elapsed-time tracking, and URL-launched games.
import { test, expect, openApp } from './fixtures.js';
import path from 'node:path';
import url from 'node:url';
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const APP_URL = url.pathToFileURL(path.join(__dirname, '..', 'index.html')).href;

async function startLevel(page, level) {
    await page.evaluate((lvl) => window.game.start(lvl), level);
    await page.waitForSelector('#screen-game:not(.hidden)');
}

test.describe('sharing + designer + path preview', () => {
    test.beforeEach(async ({ page }) => {
        await openApp(page);
    });

    test('Game: encode/decode round-trip + b64url helpers', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        const ok = await page.evaluate(() => {
            const g = window.game;
            // Round-trip a known string
            const s = 'hello — world / ?+=';
            const enc = g._b64urlEncode(s);
            const dec = g._b64urlDecode(enc);
            const roundtrip = dec === s;

            // Round-trip a board
            const id = g._encodeBoard(LEVELS.NORMAL, 8, 10, gameState.secretGems, {});
            const back = g._decodeBoard(id);
            return roundtrip && back.level === 'NORMAL' && back.w === 8 && back.h === 10 && back.gems.length === gameState.secretGems.length;
        });
        expect(ok).toBe(true);
    });

    test('Game: getCurrentGameId + gameShareUrl + startSharedGameFromId', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        const data = await page.evaluate(() => {
            const id = window.game.getCurrentGameId();
            const u = window.game.gameShareUrl(id);
            return { id, u };
        });
        expect(data.id).toBeTruthy();
        expect(data.u).toContain('mode=play');
        expect(data.u).toContain('game-id=');

        // Now start a shared game from that id (covers _decodeBoard + startSharedGameFromId)
        await page.evaluate((id) => window.game.startSharedGameFromId(id), data.id);
        await page.waitForSelector('#screen-game:not(.hidden)');

        // Invalid id triggers alert + showMainMenu branch
        await page.evaluate(() => { window.alert = () => {}; });
        await page.evaluate(() => window.game.startSharedGameFromId('not-a-real-id'));
        await expect(page.locator('#screen-main')).not.toHaveClass(/hidden/);
    });

    test('Game: getCurrentGameId on non-shareable level (GAME_SHEET) returns null', async ({ page }) => {
        await startLevel(page, 'GAME_SHEET');
        const id = await page.evaluate(() => window.game.getCurrentGameId());
        expect(id).toBeNull();
    });

    test('Game: getCurrentGameId on CUSTOM level includes used customDefs', async ({ page }) => {
        // Start a CUSTOM game with one custom-gem definition
        await page.evaluate(() => {
            gameState.customGemSet = ['CUSTOM_RED'];
            gameState.customGemDefinitions = {
                CUSTOM_RED: { name: 'CUSTOM_RED', color: '#f00', baseGems: ['RED'],
                              originalColorKey: 'RED', gridPattern: [[CellState.BLOCK]] },
            };
            window.game.start('CUSTOM', { gridWidth: 8, gridHeight: 10 });
        });
        await page.waitForSelector('#screen-game:not(.hidden)');
        const id = await page.evaluate(() => window.game.getCurrentGameId());
        expect(id).toBeTruthy();
        // Decode and confirm customDefs round-tripped
        const decoded = await page.evaluate((i) => window.game._decodeBoard(i), id);
        expect(Object.keys(decoded.customDefs)).toContain('CUSTOM_RED');
    });

    test('Game: BOARD_CREATION mode + getCurrentGameId in designer', async ({ page }) => {
        // Empty designer → no gameId
        await page.evaluate(() => window.game.start('BOARD_CREATION'));
        await page.waitForSelector('#screen-game:not(.hidden)');
        const noGemsId = await page.evaluate(() => window.game.getCurrentGameId());
        expect(noGemsId).toBeNull();

        // Place a player gem → designer can be shared
        await page.evaluate(() => window.game.addPlayerGem('YELLOW', 0, 0));
        const id = await page.evaluate(() => window.game.getCurrentGameId());
        expect(id).toBeTruthy();

        // startBoardCreation entry point
        await page.evaluate(() => window.game.startBoardCreation({ gridWidth: 8, gridHeight: 10 }, [], {}));
    });

    test('Game: decode error paths — unsupported version, missing fields, unknown level/color/gem', async ({ page }) => {
        const results = await page.evaluate(() => {
            const g = window.game;
            const enc = (obj) => g._b64urlEncode(JSON.stringify(obj));
            const tries = [];
            const tryDecode = (label, payload) => {
                try { g._decodeBoard(enc(payload)); tries.push(`${label}:ok`); }
                catch (e) { tries.push(`${label}:err`); }
            };
            tryDecode('badV', { v: 1, l: 'NORMAL', w: 8, h: 10, g: [] });
            tryDecode('noL',  { v: 3, w: 8, h: 10, g: [] });
            tryDecode('badL', { v: 3, l: 'NO_SUCH', w: 8, h: 10, g: [] });
            tryDecode('badColor', { v: 3, l: 'CUSTOM', w: 8, h: 10, g: [], d: { X: ['NO_COLOR', [[1]]] } });
            tryDecode('badGem', { v: 3, l: 'CUSTOM', w: 8, h: 10, g: [['MYSTERY', 0, 0, 0, 0]] });
            return tries;
        });
        for (const r of results) expect(r).toContain(':err');
    });

    test('Game: rotation/flip in encoded board round-trips correctly', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        const ok = await page.evaluate(() => {
            const g = window.game;
            const gems = [{
                id: 's_RED_0', name: 'RED', x: 1, y: 1,
                rotation: 90, isFlipped: true, isFlippable: true,
                gridPattern: [[CellState.BLOCK]],
            }];
            const id = g._encodeBoard(LEVELS.NORMAL, 8, 10, gems, {});
            const back = g._decodeBoard(id);
            return back.gems[0].rotation === 90 && back.gems[0].isFlipped === true;
        });
        expect(ok).toBe(true);
    });

    test('UI: openShareBoardModal + close (success + can-not-share alert)', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        await page.click('#btn-share');
        await expect(page.locator('#share-board-modal')).not.toHaveClass(/hidden/);
        // Copy buttons
        await page.click('#btn-share-copy-url');
        await page.click('#btn-share-copy-game-id');
        // Close via button
        await page.click('#btn-share-close');
        // Re-open + backdrop close
        await page.click('#btn-share');
        await page.locator('#share-board-modal').click({ position: { x: 5, y: 5 } });

        // alert: cannot share — go to GAME_SHEET (non-shareable)
        await page.evaluate(() => window.game.start('GAME_SHEET'));
        await page.evaluate(() => { window.alert = () => {}; });
        await page.evaluate(() => window.game.ui.openShareBoardModal());
    });

    test('UI: Play-with-Friends modal — open, paste, submit, cancel, backdrop', async ({ page }) => {
        // Build a valid gameId first to paste in
        await startLevel(page, 'NORMAL');
        const id = await page.evaluate(() => window.game.getCurrentGameId());

        await page.evaluate(() => window.game.showMainMenu());
        await page.click('#btn-start-game');
        await page.waitForSelector('#screen-level:not(.hidden)');

        // Click "Play against Friends" button (find by text)
        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('#level-options button'))
                .find(b => b.textContent.includes('Play against Friends'));
            btn.click();
        });
        await expect(page.locator('#play-friends-modal')).not.toHaveClass(/hidden/);

        // Submit with empty → alert
        await page.evaluate(() => { window.alert = () => {}; });
        await page.click('#btn-play-friends-start');

        // Paste valid game-id via direct input value
        await page.evaluate((i) => {
            document.getElementById('play-friends-input').value = i;
        }, id);
        await page.click('#btn-play-friends-start');
        await page.waitForSelector('#screen-game:not(.hidden)');

        // Re-open + cancel
        await page.evaluate(() => window.game.ui.openPlayFriendsModal());
        await page.click('#btn-play-friends-cancel');

        // Re-open + backdrop close
        await page.evaluate(() => window.game.ui.openPlayFriendsModal());
        await page.locator('#play-friends-modal').click({ position: { x: 5, y: 5 } });

        // Paste button — exercises clipboard read + flash. Stub clipboard.
        await page.evaluate(() => window.game.ui.openPlayFriendsModal());
        await page.evaluate(() => {
            Object.defineProperty(navigator, 'clipboard', {
                configurable: true,
                value: { readText: () => Promise.resolve('https://x/?mode=play&game-id=ABC123') },
            });
        });
        await page.click('#btn-play-friends-paste');
        await page.waitForTimeout(20);

        // Paste with empty clipboard → 'Empty' branch
        await page.evaluate(() => {
            navigator.clipboard.readText = () => Promise.resolve('');
        });
        await page.click('#btn-play-friends-paste');
        await page.waitForTimeout(20);

        // Paste with clipboard rejecting
        await page.evaluate(() => {
            navigator.clipboard.readText = () => Promise.reject(new Error('blocked'));
        });
        await page.click('#btn-play-friends-paste');
        await page.waitForTimeout(20);

        // Paste with no clipboard.readText at all
        await page.evaluate(() => {
            Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {} });
        });
        await page.click('#btn-play-friends-paste');
        await page.waitForTimeout(20);

        // _extractGameIdFromPasted edge cases
        const x = await page.evaluate(() => {
            const ui = window.game.ui;
            return [
                ui._extractGameIdFromPasted(''),
                ui._extractGameIdFromPasted(null),
                ui._extractGameIdFromPasted('https://x/?game-id=ZZZ&extra=1'),
                ui._extractGameIdFromPasted('   bareId   '),
            ];
        });
        expect(x[0]).toBe('');
        expect(x[1]).toBe('');
        expect(x[2]).toBe('ZZZ');
        expect(x[3]).toBe('bareId');
    });

    test('UI: copyToClipboard success + failure + fallback paths', async ({ page }) => {
        await startLevel(page, 'NORMAL');

        // success path via navigator.clipboard.writeText
        await page.evaluate(() => {
            Object.defineProperty(navigator, 'clipboard', {
                configurable: true,
                value: { writeText: () => Promise.resolve() },
            });
        });
        await page.evaluate(() => {
            const inp = document.createElement('input');
            inp.value = 'hello';
            document.body.appendChild(inp);
            window.game.ui._copyToClipboard(inp, document.createElement('button'));
        });
        await page.waitForTimeout(20);

        // failure path → falls through to _copyFallback
        await page.evaluate(() => {
            Object.defineProperty(navigator, 'clipboard', {
                configurable: true,
                value: { writeText: () => Promise.reject(new Error('blocked')) },
            });
        });
        await page.evaluate(() => {
            const inp = document.createElement('input');
            inp.value = 'hello';
            document.body.appendChild(inp);
            window.game.ui._copyToClipboard(inp, document.createElement('button'));
        });
        await page.waitForTimeout(20);

        // _copyToClipboard without navigator.clipboard → direct _copyFallback
        await page.evaluate(() => {
            Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
        });
        await page.evaluate(() => {
            const inp = document.createElement('input');
            inp.value = 'fallback-text';
            document.body.appendChild(inp);
            window.game.ui._copyToClipboard(inp, document.createElement('button'));
        });

        // _copyFallback no-btn branch
        await page.evaluate(() => {
            const inp = document.createElement('input');
            inp.value = 'no-btn';
            document.body.appendChild(inp);
            window.game.ui._copyToClipboard(inp, null);
        });

        // _copyFallback throw branch — replace execCommand to throw
        await page.evaluate(() => {
            const orig = document.execCommand;
            document.execCommand = () => { throw new Error('blocked'); };
            const inp = document.createElement('input');
            inp.value = 'will-throw';
            document.body.appendChild(inp);
            window.game.ui._copyToClipboard(inp, document.createElement('button'));
            document.execCommand = orig;
        });
    });

    test('UI: end-screen share section + copy buttons', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        // Win quickly
        await page.evaluate(() => {
            gameState.playerGems = gameState.secretGems.map((g, i) => Object.assign({}, JSON.parse(JSON.stringify(g)), { id: `p_${i}`, isValid: true }));
        });
        await page.evaluate(() => window.game.checkSolution());
        await expect(page.locator('#end-share-section')).toBeVisible();
        await page.click('#btn-end-copy-url');
        await page.click('#btn-end-copy-game-id');
    });

    test('UI: player-path preview toggle (f key + Show/Hide buttons)', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        // Place a gem + send a wave so the preview has something to draw
        await page.evaluate(() => window.game.addPlayerGem('YELLOW', 0, 0));
        await page.evaluate(() => window.game.sendWave('T1'));

        // Show the player-path switch wrapper
        await page.evaluate(() => { window.game.ui.playerPathSwitchWrapper.hidden = false; });

        // 'f' key toggles
        await page.locator('#gem-canvas').focus();
        await page.keyboard.press('f');
        await page.keyboard.press('F');

        // Direct API
        await page.evaluate(() => window.game.setPlayerPathPreview(true));
        await page.evaluate(() => window.game.setPlayerPathPreview(true)); // no-op same state
        await page.evaluate(() => window.game.togglePlayerPathPreview());

        // _updateActivePlayerPathPreview without a selected log → bails
        await page.evaluate(() => { gameState.previewSourceEmitterId = null; window.game._updateActivePlayerPathPreview(); });
        // With selected QUERY log → also bails (not WAVE)
        await page.evaluate(() => {
            gameState.previewSourceEmitterId = 'T1';
            gameState.selectedLogEntryId = 'query_x_y';
            gameState.log.push({ id: 'query_x_y', type: InteractionMode.QUERY });
            window.game._updateActivePlayerPathPreview();
        });
    });

    test('UI: showCustomCreator with mode "board-creation" routes through designer', async ({ page }) => {
        await page.evaluate(() => window.game.showCustomCreator('board-creation'));
        await page.waitForSelector('#screen-custom-creator:not(.hidden)');
        // Add one gem so the start button enables
        await page.click('#custom-color-selector .color-choice[data-color-key="YELLOW"]');
        await page.click('#custom-shape-selector .shape-choice[data-shape-key="SHAPE_DIAMOND"]');
        await page.click('#btn-add-custom-gem');
        // Start Level button text should be "Place gems" in board-creation mode
        const txt = await page.locator('#btn-start-custom-level').textContent();
        expect(txt).toContain('Place gems');
        await page.click('#btn-start-custom-level');
        await page.waitForSelector('#screen-game:not(.hidden)');
    });

    test('Game: getTotalElapsedMs + pause/resume timer accounting', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        const e1 = await page.evaluate(() => window.game.getTotalElapsedMs());
        expect(e1).toBeGreaterThanOrEqual(0);

        // Suspend then resume the session timer through the lifecycle methods if they exist
        await page.evaluate(() => {
            // Reset _sessionStartAt to null to exercise the no-live branch
            window.game._sessionStartAt = null;
        });
        const e2 = await page.evaluate(() => window.game.getTotalElapsedMs());
        expect(e2).toBeGreaterThanOrEqual(0);
    });

    test('main.js: URL with mode=play&game-id=<id> launches the shared game on load', async ({ page }) => {
        // First create a valid id with the app open normally
        await openApp(page);
        await startLevel(page, 'NORMAL');
        const id = await page.evaluate(() => window.game.getCurrentGameId());

        // Now reload the page with that game-id in the URL
        await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
        await page.goto(APP_URL + '?mode=play&game-id=' + id);
        await page.waitForSelector('#screen-game:not(.hidden)');

        // Reload with an invalid game-id — should alert + fall back to main
        await page.evaluate(() => { window.alert = () => {}; });
        await page.goto(APP_URL + '?mode=play&game-id=BOGUS-INVALID');
        await page.waitForSelector('#screen-main:not(.hidden)');

        // URL-launched game where history.replaceState throws — exercises the catch on main.js:15
        await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
        await page.addInitScript(() => {
            const orig = history.replaceState;
            history.replaceState = function () { throw new Error('blocked'); };
            window.addEventListener('load', () => {
                // Restore after main.js has executed so other tests aren't affected
                setTimeout(() => { history.replaceState = orig; }, 50);
            });
        });
        await page.goto(APP_URL + '?mode=play&game-id=' + id);
        await page.waitForSelector('#screen-game:not(.hidden)');
    });

    // --- Targeted gap-closure tests -----------------------------------------

    test('_updateActivePlayerPathPreview: second-early-return body (no sourceId / QUERY type)', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        await page.evaluate(() => {
            gameState.showPlayerPathPreview = true;
            gameState.previewSourceEmitterId = null;
            window.game._updateActivePlayerPathPreview();

            gameState.previewSourceEmitterId = 'T1';
            gameState.selectedLogEntryId = 'q1';
            gameState.log.push({ id: 'q1', type: InteractionMode.QUERY });
            window.game._updateActivePlayerPathPreview();
        });
    });

    test('BOARD_CREATION: getCurrentGameId packages a custom-def for a placed custom gem', async ({ page }) => {
        await page.evaluate(() => {
            gameState.customGemSet = ['CUSTOM_RED'];
            gameState.customGemDefinitions = {
                CUSTOM_RED: { name: 'CUSTOM_RED', color: '#f00', baseGems: ['RED'],
                              originalColorKey: 'RED', gridPattern: [[CellState.BLOCK]] },
            };
            window.game.start('BOARD_CREATION', { gridWidth: 8, gridHeight: 10 });
            window.game.addPlayerGem('CUSTOM_RED', 0, 0);
        });
        const id = await page.evaluate(() => window.game.getCurrentGameId());
        const decoded = await page.evaluate((i) => window.game._decodeBoard(i), id);
        expect(Object.keys(decoded.customDefs)).toContain('CUSTOM_RED');
    });

    test('startSharedGameFromId NORMAL: clears any stale customGemSet/Definitions', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        const id = await page.evaluate(() => window.game.getCurrentGameId());
        await page.evaluate(() => {
            gameState.customGemSet = ['STALE'];
            gameState.customGemDefinitions = { STALE: { name: 'STALE' } };
        });
        await page.evaluate((i) => window.game.startSharedGameFromId(i), id);
        const cleared = await page.evaluate(() => gameState.customGemSet.length);
        expect(cleared).toBe(0);
    });

    test('startSharedGameFromId CUSTOM: restores customGemDefinitions from payload', async ({ page }) => {
        await page.evaluate(() => {
            gameState.customGemSet = ['CUSTOM_R'];
            gameState.customGemDefinitions = {
                CUSTOM_R: { name: 'CUSTOM_R', color: '#f00', baseGems: ['RED'],
                            originalColorKey: 'RED', gridPattern: [[CellState.BLOCK]] },
            };
            window.game.start('CUSTOM', { gridWidth: 8, gridHeight: 10 });
        });
        await page.waitForSelector('#screen-game:not(.hidden)');
        const id = await page.evaluate(() => window.game.getCurrentGameId());
        await page.evaluate(() => {
            gameState.customGemDefinitions = {};
            gameState.customGemSet = [];
        });
        await page.evaluate((i) => window.game.startSharedGameFromId(i), id);
        const restored = await page.evaluate(() => Object.keys(gameState.customGemDefinitions));
        expect(restored).toContain('CUSTOM_R');
    });

    test('showCustomCreator() with no arg falls back to "custom" mode', async ({ page }) => {
        await page.evaluate(() => {
            window.game._customCreatorMode = null;
            window.game.showCustomCreator();
        });
        await page.waitForSelector('#screen-custom-creator:not(.hidden)');
    });

    test('showScreen("custom-creator") with _customCreatorMode null hits the || fallback', async ({ page }) => {
        await page.evaluate(() => {
            window.game._customCreatorMode = null;
            window.game.ui.showScreen('custom-creator');
        });
        await page.waitForSelector('#screen-custom-creator:not(.hidden)');
    });

    test('Web Share API: native-share button reveal + _shareViaApp success / cancel / fail', async ({ page }) => {
        // Re-construct UI with navigator.share present so the reveal branch runs.
        await page.evaluate(() => {
            Object.defineProperty(navigator, 'share', {
                configurable: true, writable: true,
                value: () => Promise.resolve(),
            });
            // Re-bind global events so the reveal branch executes
            window.game.ui.bindGlobalEvents();
        });

        await startLevel(page, 'NORMAL');

        // _shareViaApp success path
        await page.evaluate(() => window.game.ui._shareViaApp('https://x/?mode=play&game-id=ABC', null));

        // Success path with a button → flash (no actual flash since resolved without error)
        await page.evaluate(() => {
            const btn = document.createElement('button');
            btn.innerHTML = 'Share';
            window.game.ui._shareViaApp('https://x/?mode=play&game-id=ABC', btn);
        });

        // User cancelled (AbortError) — should NOT flash failure
        await page.evaluate(() => {
            const err = new Error('cancelled'); err.name = 'AbortError';
            navigator.share = () => Promise.reject(err);
            const btn = document.createElement('button');
            btn.innerHTML = 'Share';
            window.game.ui._shareViaApp('https://x/', btn);
        });
        await page.waitForTimeout(20);

        // Generic share failure → flash 'Share failed'
        await page.evaluate(() => {
            navigator.share = () => Promise.reject(new Error('boom'));
            const btn = document.createElement('button');
            btn.innerHTML = 'Share';
            window.game.ui._shareViaApp('https://x/', btn);
        });
        await page.waitForTimeout(20);

        // Early returns: no url + no navigator.share
        await page.evaluate(() => window.game.ui._shareViaApp('', null));
        await page.evaluate(() => {
            delete navigator.share;
            window.game.ui._shareViaApp('https://x/', null);
        });
    });

    test('BOARD_CREATION: fireAllRays traces all emitters through placed gems', async ({ page }) => {
        await page.evaluate(() => {
            gameState.customGemSet = ['YELLOW'];
            gameState.customGemDefinitions = {};
            window.game.start('BOARD_CREATION', { gridWidth: 8, gridHeight: 10 });
            window.game.addPlayerGem('YELLOW', 2, 3);
        });
        await page.evaluate(() => window.game.fireAllRays());
        const logLen = await page.evaluate(() => gameState.log.length);
        // 2*(8+10) = 36 emitters
        expect(logLen).toBe(36);
        const waveCount = await page.evaluate(() => gameState.waveCount);
        expect(waveCount).toBe(36);
    });

    test('BOARD_CREATION: fireAllRays is no-op when not in board-creation mode', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        await page.evaluate(() => window.game.fireAllRays());
        const logLen = await page.evaluate(() => gameState.log.length);
        expect(logLen).toBe(0);
    });

    test('BOARD_CREATION: sendWave and queryCell are blocked', async ({ page }) => {
        await page.evaluate(() => {
            window.game.start('BOARD_CREATION', { gridWidth: 8, gridHeight: 10 });
        });
        await page.evaluate(() => window.game.sendWave('T1'));
        const waveLogs = await page.evaluate(() => gameState.log.length);
        expect(waveLogs).toBe(0);
        await page.evaluate(() => {
            gameState.interactionMode = InteractionMode.QUERY;
            window.game.queryCell(0, 0);
        });
        const queryLogs = await page.evaluate(() => gameState.log.length);
        expect(queryLogs).toBe(0);
    });

    test('BOARD_CREATION: playSolutionBtn enabled only when all gems placed and valid', async ({ page }) => {
        await page.evaluate(() => {
            gameState.customGemSet = ['YELLOW'];
            gameState.customGemDefinitions = {};
            window.game.start('BOARD_CREATION', { gridWidth: 8, gridHeight: 10 });
        });
        // No gems placed → disabled
        const dis1 = await page.evaluate(() => window.game.ui.playSolutionBtn.disabled);
        expect(dis1).toBe(true);
        // Place the gem → enabled
        await page.evaluate(() => window.game.addPlayerGem('YELLOW', 0, 0));
        const dis2 = await page.evaluate(() => window.game.ui.playSolutionBtn.disabled);
        expect(dis2).toBe(false);
        // Remove it → disabled again
        await page.evaluate(() => {
            const id = gameState.playerGems[0].id;
            window.game.removePlayerGem(id);
        });
        const dis3 = await page.evaluate(() => window.game.ui.playSolutionBtn.disabled);
        expect(dis3).toBe(true);
    });

    test('BOARD_CREATION: action-mode-wrapper is hidden, playSolutionBtn is visible', async ({ page }) => {
        await page.evaluate(() => window.game.start('BOARD_CREATION', { gridWidth: 8, gridHeight: 10 }));
        await page.waitForSelector('#screen-game:not(.hidden)');
        await expect(page.locator('#action-mode-wrapper')).toBeHidden();
        await expect(page.locator('#play-solution-btn')).not.toBeHidden();
    });

    test('BOARD_CREATION: handleStartCustomLevel in board-creation mode calls startBoardCreation', async ({ page }) => {
        await page.evaluate(() => window.game.showCustomCreator('board-creation'));
        await page.waitForSelector('#screen-custom-creator:not(.hidden)');
        await page.click('#custom-color-selector .color-choice[data-color-key="YELLOW"]');
        await page.click('#custom-shape-selector .shape-choice[data-shape-key="SHAPE_DIAMOND"]');
        await page.click('#btn-add-custom-gem');
        await page.click('#btn-start-custom-level');
        await page.waitForSelector('#screen-game:not(.hidden)');
        const level = await page.evaluate(() => gameState.level);
        expect(level).toBe('BOARD_CREATION');
    });

    test('BOARD_CREATION: placeGemsRandomly places all gems and enables play-solution btn', async ({ page }) => {
        await page.evaluate(() => {
            gameState.customGemSet = ['YELLOW', 'RED'];
            gameState.customGemDefinitions = {};
            window.game.start('BOARD_CREATION', { gridWidth: 8, gridHeight: 10 });
        });
        const before = await page.evaluate(() => gameState.playerGems.length);
        expect(before).toBe(0);
        await page.evaluate(() => window.game.placeGemsRandomly());
        const after = await page.evaluate(() => gameState.playerGems.length);
        expect(after).toBe(2);
        const allValid = await page.evaluate(() => gameState.playerGems.every(g => g.isValid));
        expect(allValid).toBe(true);
        const dis = await page.evaluate(() => window.game.ui.playSolutionBtn.disabled);
        expect(dis).toBe(false);
    });

    test('BOARD_CREATION: placeGemsRandomly flips flippable gems when random < 0.5', async ({ page }) => {
        const result = await page.evaluate(() => {
            gameState.customGemSet = ['RED'];
            gameState.customGemDefinitions = {};
            window.game.start('BOARD_CREATION', { gridWidth: 8, gridHeight: 10 });
            const origRandom = Math.random;
            Math.random = () => 0.1;
            window.game.placeGemsRandomly();
            Math.random = origRandom;
            return {
                count: gameState.playerGems.length,
                gem: gameState.playerGems[0],
            };
        });
        expect(result.count).toBe(1);
        expect(result.gem.isFlipped).toBe(true);
    });

    test('BOARD_CREATION: placeGemsRandomly is no-op outside board-creation mode', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        await page.evaluate(() => window.game.placeGemsRandomly());
        const len = await page.evaluate(() => gameState.playerGems.length);
        expect(len).toBe(0);
    });

    test('BOARD_CREATION: revealedMode blocks gem drag and canvas tap interactions', async ({ page }) => {
        await page.evaluate(() => {
            gameState.customGemSet = ['YELLOW'];
            gameState.customGemDefinitions = {};
            window.game.start('BOARD_CREATION', { gridWidth: 8, gridHeight: 10 });
            window.game.addPlayerGem('YELLOW', 2, 3);
        });
        await page.evaluate(() => window.game.fireAllRays());
        const revealed = await page.evaluate(() => gameState.revealedMode);
        expect(revealed).toBe(true);
        // Toolbar and play-solution btn should be hidden
        await expect(page.locator('#gem-toolbar-wrapper')).toBeHidden();
        await expect(page.locator('#play-solution-btn')).toBeHidden();
        await expect(page.locator('#place-gems-randomly-btn')).toBeHidden();
        // Path switch wrapper should be visible
        await expect(page.locator('#path-switch-wrapper')).not.toBeHidden();
        // Gem should not be movable — dispatch on canvas to get a valid target
        const gemPos = await page.evaluate(() => {
            const gem = gameState.playerGems[0];
            return { x: gem.x, y: gem.y };
        });
        await page.evaluate(() => {
            const canvas = document.getElementById('gem-canvas');
            const rect = canvas.getBoundingClientRect();
            canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: rect.left + 50, clientY: rect.top + 50, bubbles: true }));
        });
        const dragInfo = await page.evaluate(() => window.game.ui.inputHandler.dragStartInfo);
        expect(dragInfo).not.toBeNull();
        expect(dragInfo.item).toBeNull();
        const gemPosAfter = await page.evaluate(() => {
            const gem = gameState.playerGems[0];
            return { x: gem.x, y: gem.y };
        });
        expect(gemPosAfter).toEqual(gemPos);
    });

    test('BOARD_CREATION: revealedMode blocks toggleBlockedCell via canvas tap', async ({ page }) => {
        await page.evaluate(() => {
            gameState.customGemSet = ['YELLOW'];
            gameState.customGemDefinitions = {};
            window.game.start('BOARD_CREATION', { gridWidth: 8, gridHeight: 10 });
            window.game.addPlayerGem('YELLOW', 2, 3);
            window.game.fireAllRays();
        });
        const blockedBefore = await page.evaluate(() => gameState.blockedCells.length);
        await page.evaluate(() => {
            window.game.ui.inputHandler.handleCanvasTap(50, 50);
        });
        const blockedAfter = await page.evaluate(() => gameState.blockedCells.length);
        expect(blockedAfter).toBe(blockedBefore);
    });

    test('BOARD_CREATION: place-gems-randomly-btn is visible in board creation', async ({ page }) => {
        await page.evaluate(() => window.game.start('BOARD_CREATION', { gridWidth: 8, gridHeight: 10 }));
        await page.waitForSelector('#screen-game:not(.hidden)');
        await expect(page.locator('#place-gems-randomly-btn')).not.toBeHidden();
    });

    test('updateEndShareSection: no gameId hides the section (and no-section early return)', async ({ page }) => {
        await startLevel(page, 'GAME_SHEET');
        await page.evaluate(() => window.game.ui.updateEndShareSection());
        await expect(page.locator('#end-share-section')).toBeHidden();
        await page.evaluate(() => {
            const orig = window.game.ui.endShareSection;
            window.game.ui.endShareSection = null;
            window.game.ui.updateEndShareSection();
            window.game.ui.endShareSection = orig;
        });
    });
});
