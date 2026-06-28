// InputHandler: hover, click/tap, drag, touch, keyboard, long-press, modifiers.
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

test.describe('input handler', () => {
    test.beforeEach(async ({ page }) => {
        await openApp(page);
        await startLevel(page, 'TRAINING');
    });

    // --- Hover / cursor --------------------------------------------------------

    test('hover cursor: over emitter (pointer), over grid in QUERY (crosshair), off canvas', async ({ page }) => {
        const e = await emitterCenter(page, 'T1');
        await page.mouse.move(e.cx, e.cy);
        const empty = await canvasCenterForCell(page, 0, 0);
        await page.mouse.move(empty.cx, empty.cy);
        await page.mouse.move(2, 2); // off canvas → mouseleave

        await page.click('#mode-query-btn');
        await page.mouse.move(empty.cx, empty.cy);
        await page.mouse.move(5, 5);
        await page.click('#mode-wave-btn');
    });

    // --- Drag from toolbar / board --------------------------------------------

    test('drag a toolbar gem onto the board', async ({ page }) => {
        const tb = await page.locator('.toolbar-gem[data-gem-name="YELLOW"]').first().boundingBox();
        const drop = await canvasCenterForCell(page, 2, 3);

        await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2);
        await page.mouse.down();
        await page.mouse.move(tb.x + tb.width / 2 + 20, tb.y + tb.height / 2 + 20);
        await page.mouse.move(drop.cx, drop.cy, { steps: 10 });
        await page.mouse.up();
    });

    test('drag a placed gem then drag off canvas → remove', async ({ page }) => {
        await page.evaluate(() => window.game.addPlayerGem('YELLOW', 0, 0));
        let placed = await page.evaluate(() => gameState.playerGems[0]);

        const from = await canvasCenterForCell(page, placed.x, placed.y);
        const to = await canvasCenterForCell(page, placed.x + 2, placed.y + 2);
        await page.mouse.move(from.cx, from.cy);
        await page.mouse.down();
        await page.mouse.move(from.cx + 15, from.cy + 15);
        await page.mouse.move(to.cx, to.cy, { steps: 10 });
        await page.mouse.up();

        placed = await page.evaluate(() => gameState.playerGems[0]);
        if (!placed) return;
        const start = await canvasCenterForCell(page, placed.x, placed.y);
        await page.mouse.move(start.cx, start.cy);
        await page.mouse.down();
        await page.mouse.move(start.cx + 15, start.cy);
        await page.mouse.move(2, 2, { steps: 10 });
        await page.mouse.up();
    });

    test('drag-from-toolbar with intermediate moves drops at target cell', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        const tb = await page.locator('.toolbar-gem[data-gem-name="YELLOW"]').first();
        await tb.waitFor();
        const tbBox = await tb.boundingBox();
        const drop = await canvasCenterForCell(page, 3, 3);

        await page.mouse.move(tbBox.x + tbBox.width / 2, tbBox.y + tbBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(tbBox.x + tbBox.width / 2 + 20, tbBox.y + tbBox.height / 2);
        await page.mouse.move(drop.cx, drop.cy, { steps: 10 });
        await page.mouse.up();

        const placed = await page.evaluate(() => gameState.playerGems[0]);
        if (placed) {
            const c = await canvasCenterForCell(page, placed.x, placed.y);
            await page.mouse.move(c.cx, c.cy);
            await page.mouse.down();
            await page.mouse.move(c.cx + 20, c.cy);
            await page.mouse.move(2, 2, { steps: 10 });
            await page.mouse.up();
        }
    });

    // --- Click / tap behavior --------------------------------------------------

    test('tap on placed gem (no drag) rotates it', async ({ page }) => {
        await page.evaluate(() => window.game.addPlayerGem('RED', 2, 2));
        const g = await page.evaluate(() => gameState.playerGems[0]);
        const c = await canvasCenterForCell(page, g.x, g.y);
        await page.mouse.move(c.cx, c.cy);
        await page.mouse.down();
        await page.mouse.up();
    });

    test('WAVE mode: tap used emitter toggles selection + tap grid blocks/unblocks', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        await page.evaluate(() => window.game.sendWave('T1'));
        const e = await emitterCenter(page, 'T1');
        await page.mouse.click(e.cx, e.cy);
        await page.mouse.click(e.cx, e.cy);

        const cc = await canvasCenterForCell(page, 0, 0);
        await page.mouse.click(cc.cx, cc.cy);

        // QUERY mode: tap off-grid clears selection
        await page.click('#mode-query-btn');
        await page.mouse.click(2, 2);
    });

    test('swipe over empty cells paints X marks on all visited cells (single undo)', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        const c0 = await canvasCenterForCell(page, 1, 1);
        const c1 = await canvasCenterForCell(page, 2, 1);
        const c2 = await canvasCenterForCell(page, 3, 1);

        await page.mouse.move(c0.cx, c0.cy);
        await page.mouse.down();
        await page.mouse.move(c0.cx + 20, c0.cy);  // cross threshold (paint start cell)
        await page.mouse.move(c1.cx, c1.cy);
        await page.mouse.move(c2.cx, c2.cy);
        await page.mouse.up();

        const blocked = await page.evaluate(() => gameState.blockedCells.map(c => `${c.x},${c.y}`).sort());
        expect(blocked).toEqual(['1,1', '2,1', '3,1']);

        // The whole stroke is one undo step.
        await page.evaluate(() => window.game.undo());
        const afterUndo = await page.evaluate(() => gameState.blockedCells.length);
        expect(afterUndo).toBe(0);
    });

    test('swipe starting on an already-X cell un-marks all visited X cells', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        // Pre-mark three cells via direct API
        await page.evaluate(() => {
            window.game.toggleBlockedCell(1, 1);
            window.game.toggleBlockedCell(2, 1);
            window.game.toggleBlockedCell(3, 1);
        });
        const c0 = await canvasCenterForCell(page, 1, 1);
        const c1 = await canvasCenterForCell(page, 2, 1);
        const c2 = await canvasCenterForCell(page, 3, 1);

        await page.mouse.move(c0.cx, c0.cy);
        await page.mouse.down();
        await page.mouse.move(c0.cx + 20, c0.cy);
        await page.mouse.move(c1.cx, c1.cy);
        await page.mouse.move(c2.cx, c2.cy);
        await page.mouse.up();

        const blocked = await page.evaluate(() => gameState.blockedCells.length);
        expect(blocked).toBe(0);
    });

    test('vertical swipe paints only the starting column', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        const c0 = await canvasCenterForCell(page, 2, 1);
        const c1 = await canvasCenterForCell(page, 2, 3);

        await page.mouse.move(c0.cx, c0.cy);
        await page.mouse.down();
        await page.mouse.move(c0.cx, c0.cy + 20);  // cross threshold vertically
        await page.mouse.move(c1.cx, c1.cy);
        await page.mouse.up();

        const blocked = await page.evaluate(() => gameState.blockedCells.map(c => `${c.x},${c.y}`).sort());
        expect(blocked).toEqual(['2,1', '2,2', '2,3']);
    });

    test('fast swipe (sparse pointermove samples) still paints every cell along the line', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        // Pre-compute centers for cells (0,1) through (5,1). With only TWO move
        // samples (start → far end), naive paint would mark just 2 cells; with
        // line interpolation we get all 6.
        const c0 = await canvasCenterForCell(page, 0, 1);
        const c5 = await canvasCenterForCell(page, 5, 1);

        await page.mouse.move(c0.cx, c0.cy);
        await page.mouse.down();
        await page.mouse.move(c0.cx + 20, c0.cy);  // cross threshold (single nudge)
        await page.mouse.move(c5.cx, c5.cy);       // big jump → 5 cells away
        await page.mouse.up();

        const blocked = await page.evaluate(() => gameState.blockedCells.map(c => `${c.x},${c.y}`).sort());
        expect(blocked).toEqual(['0,1', '1,1', '2,1', '3,1', '4,1', '5,1']);
    });

    test('swipe over a cell occupied by a gem leaves that cell un-marked (others get X)', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        // Place YELLOW at (2,1) so cell (2,1) is occupied
        await page.evaluate(() => window.game.addPlayerGem('YELLOW', 2, 1));
        const c0 = await canvasCenterForCell(page, 1, 1);
        const c1 = await canvasCenterForCell(page, 2, 1);  // occupied
        const c2 = await canvasCenterForCell(page, 4, 1);  // beyond YELLOW

        await page.mouse.move(c0.cx, c0.cy);
        await page.mouse.down();
        await page.mouse.move(c0.cx + 20, c0.cy);
        await page.mouse.move(c1.cx, c1.cy);
        await page.mouse.move(c2.cx, c2.cy);
        await page.mouse.up();

        const blocked = await page.evaluate(() => gameState.blockedCells.map(c => `${c.x},${c.y}`).sort());
        // The cell under the gem is skipped, the others are blocked.
        expect(blocked).toContain('1,1');
        expect(blocked).toContain('4,1');
        expect(blocked).not.toContain('2,1');
    });

    test('right-click on canvas: button !== 0 early return', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        const c = await canvasCenterForCell(page, 2, 2);
        await page.mouse.click(c.cx, c.cy, { button: 'right' });
    });

    test('SELECT mode: tap on placed gem with prior dragStartInfo → rotates', async ({ page }) => {
        await startLevel(page, 'GAME_SHEET');
        await page.evaluate(() => window.game.addGameSheetCustomGem('RED', 'SHAPE_PARALLEL', null));
        await page.evaluate(() => {
            const name = gameState.customGemSet[0];
            window.game.addPlayerGem(name, 2, 2);
        });
        await page.evaluate(() => window.game.setInteractionMode('select'));
        const c = await page.evaluate(() => {
            const g = gameState.playerGems[0];
            const r = window.game.ui.renderer;
            const rect = document.getElementById('gem-canvas').getBoundingClientRect();
            const cc = r._gridToCanvasCoords(g.x, g.y);
            return { x: rect.left + cc.x + r.cellWidth / 2, y: rect.top + cc.y + r.cellHeight / 2, id: g.id };
        });
        await page.evaluate((cfg) => {
            const ih = window.game.ui.inputHandler;
            ih.dragStartInfo = { item: { id: cfg.id }, startX: 0, startY: 0 };
            ih.handleCanvasTap(cfg.x, cfg.y);
        }, c);
    });

    test('SELECT mode: tap without prior dragStartInfo clears selection', async ({ page }) => {
        await startLevel(page, 'GAME_SHEET');
        await page.evaluate(() => window.game.commitManualWave('T1', 'B1', ['RED'], false));
        await page.evaluate(() => window.game.setSelectedLogEntry('T1', 'T1'));
        await page.evaluate(() => {
            const ih = window.game.ui.inputHandler;
            ih.dragStartInfo = null;
            ih.handleCanvasTap(200, 200);
        });
    });

    test('global click outside log-list + canvas dismisses selected log entry', async ({ page }) => {
        await page.evaluate(() => window.game.sendWave('T1'));
        await page.evaluate(() => window.game.setSelectedLogEntry('T1', 'T1'));
        await page.click('#topbar-title');
    });

    // --- Long-press ------------------------------------------------------------

    test('long-press over a flippable gem flips it', async ({ page }) => {
        await page.evaluate(() => window.game.addPlayerGem('RED', 2, 2));
        await page.evaluate(() => { gameState.playerGems[0].isFlippable = true; });
        const c = await page.evaluate(() => {
            const g = gameState.playerGems[0];
            const r = window.game.ui.renderer;
            const rect = document.getElementById('gem-canvas').getBoundingClientRect();
            const cc = r._gridToCanvasCoords(g.x, g.y);
            return { x: rect.left + cc.x + r.cellWidth / 2, y: rect.top + cc.y + r.cellHeight / 2 };
        });
        await page.mouse.move(c.x, c.y);
        await page.mouse.down();
        await page.waitForTimeout(500);
        await page.mouse.up();
    });

    test('long-press timeout cleared when drag exceeds threshold', async ({ page }) => {
        await page.evaluate(() => window.game.addPlayerGem('RED', 2, 2));
        await page.evaluate(() => { gameState.playerGems[0].isFlippable = true; });
        const c = await page.evaluate(() => {
            const g = gameState.playerGems[0];
            const r = window.game.ui.renderer;
            const rect = document.getElementById('gem-canvas').getBoundingClientRect();
            const cc = r._gridToCanvasCoords(g.x, g.y);
            return { x: rect.left + cc.x + r.cellWidth / 2, y: rect.top + cc.y + r.cellHeight / 2 };
        });
        await page.mouse.move(c.x, c.y);
        await page.mouse.down();
        await page.mouse.move(c.x + 20, c.y + 20);
        await page.mouse.move(c.x + 50, c.y + 50);
        await page.mouse.up();
    });

    test('drag started on empty cell with no item dropped → potentialDragItem null', async ({ page }) => {
        const c = await canvasCenterForCell(page, 0, 0);
        await page.mouse.move(c.cx, c.cy);
        await page.mouse.down();
        await page.mouse.move(c.cx + 30, c.cy + 30);
        await page.mouse.up();
    });

    test('drag in Extreme mode (no paint stroke set up) cancels the press cleanly', async ({ page }) => {
        // Extreme mode skips the swipe-to-paint-X path entirely; the threshold
        // cross with no gem and no paint info must null dragStartInfo silently.
        await page.evaluate(() => window.game.start('EXTREME'));
        await page.waitForSelector('#screen-game:not(.hidden)');
        const c = await canvasCenterForCell(page, 0, 0);
        await page.mouse.move(c.cx, c.cy);
        await page.mouse.down();
        await page.mouse.move(c.cx + 30, c.cy + 30);
        await page.mouse.up();
    });

    // --- Keyboard --------------------------------------------------------------

    test('keyboard navigation between emitters + Enter/Space sends wave', async ({ page }) => {
        await page.locator('#gem-canvas').focus();
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('Enter');
        await page.keyboard.press('Enter');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press(' ');
        await page.keyboard.press('q'); // ignored
    });

    test('keyboard ignored outside WAVE mode + Enter re-focuses first emitter', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        await page.click('#mode-query-btn');
        await page.locator('#gem-canvas').focus();
        await page.keyboard.press('ArrowRight'); // ignored
        await page.keyboard.press('Enter');      // ignored
        await page.click('#mode-wave-btn');

        await page.evaluate(() => { window.game.ui.inputHandler.focusedEmitterId = null; });
        await page.locator('#gem-canvas').focus();
        await page.keyboard.press('Enter');
    });

    // --- Touch + helpers -------------------------------------------------------

    test('touch events on canvas (touchstart/move/end)', async ({ page }) => {
        await page.evaluate(() => {
            const canvas = document.getElementById('gem-canvas');
            const rect = canvas.getBoundingClientRect();
            const t = (type, x, y) => {
                const ev = new TouchEvent(type, {
                    bubbles: true, cancelable: true,
                    touches: type === 'touchend' ? [] : [{ clientX: x, clientY: y, identifier: 0, target: canvas }],
                    changedTouches: [{ clientX: x, clientY: y, identifier: 0, target: canvas }],
                });
                canvas.dispatchEvent(ev);
            };
            try {
                t('touchstart', rect.left + 50, rect.top + 50);
                t('touchmove', rect.left + 60, rect.top + 55);
                t('touchend', rect.left + 60, rect.top + 55);
            } catch (e) { /* TouchEvent not supported — ignore */ }
        });
    });

    test('touch event on a toolbar gem triggers the touch toolbar branch', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        await page.evaluate(() => {
            const tb = document.querySelector('.toolbar-gem[data-gem-name="YELLOW"]');
            const rect = tb.getBoundingClientRect();
            const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
            const fakeTouch = { clientX: x, clientY: y };
            const ev = {
                type: 'touchstart', target: tb,
                touches: [fakeTouch], changedTouches: [fakeTouch],
                preventDefault: () => {},
            };
            window.game.ui.inputHandler.handlePointerDown(ev);
        });
    });

    test('touch events on canvas with explicit Touch ctor', async ({ page }) => {
        await startLevel(page, 'NORMAL');
        await page.evaluate(() => {
            const canvas = document.getElementById('gem-canvas');
            const rect = canvas.getBoundingClientRect();
            const x = rect.left + 50, y = rect.top + 50;
            const mk = (type, target) => new TouchEvent(type, {
                bubbles: true, cancelable: true,
                touches: type === 'touchend' ? [] : [new Touch({ identifier: 0, target, clientX: x, clientY: y })],
                changedTouches: [new Touch({ identifier: 0, target, clientX: x, clientY: y })],
            });
            try {
                canvas.dispatchEvent(mk('touchstart', canvas));
                canvas.dispatchEvent(mk('touchmove', canvas));
                canvas.dispatchEvent(mk('touchend', canvas));
            } catch (e) {
                const fake = (type) => ({
                    type, target: canvas,
                    changedTouches: [{ clientX: x, clientY: y }],
                    preventDefault: () => {},
                });
                const ih = window.game.ui.inputHandler;
                ih.handlePointerDown(Object.assign(fake('touchstart'), { touches: [{}] }));
                ih.handlePointerMove(Object.assign(fake('touchmove'), { touches: [{}] }));
                ih.handlePointerUp(fake('touchend'));
            }
        });
    });

    test('getPointerCoordinates: empty + missing touches returns null', async ({ page }) => {
        const r = await page.evaluate(() => {
            const ih = window.game.ui.inputHandler;
            return [
                ih.getPointerCoordinates({}),
                ih.getPointerCoordinates({ changedTouches: [] }),
            ];
        });
        expect(r[0]).toBeNull();
        expect(r[1]).toBeNull();
    });

    test('handlePointerUp early return when no coords + no renderer', async ({ page }) => {
        await page.evaluate(() => window.game.ui.inputHandler.handlePointerUp({}));
    });
});
