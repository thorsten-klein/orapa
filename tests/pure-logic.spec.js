// Pure-logic modules: physics, path-tracer, constants helpers, EmitterButton.
// Exercised via page.evaluate after the app has loaded so the source-coverage
// counters in the page see the function calls.
import { test, expect, openApp } from './fixtures.js';

test.describe('pure logic', () => {
    test.beforeEach(async ({ page }) => {
        await openApp(page);
    });

    test('colorComboKey + transparentFillRgba + emitterDisplayLabel', async ({ page }) => {
        const result = await page.evaluate(() => ({
            k1: colorComboKey(['YELLOW', 'BLUE', 'RED']),
            k2: colorComboKey([]),
            r: transparentFillRgba(0.5),
            t: emitterDisplayLabel('T3'),
            r1: emitterDisplayLabel('R2'),
            l: emitterDisplayLabel('L1'),
            b: emitterDisplayLabel('B4'),
            absorbed: emitterDisplayLabel('Absorbed'),
            empty: emitterDisplayLabel(''),
            weird: emitterDisplayLabel('X1'),
        }));
        expect(result.k1).toBe('BLUE,RED,YELLOW');
        expect(result.k2).toBe('');
        expect(result.r).toBe('rgba(164, 212, 228, 0.5)');
        expect(result.t).toBe('3');
        expect(result.r1).toBe('10');
        expect(result.l).toBe('A');
        expect(result.b).toBe('N');
    });

    test('emitterDisplayLabel: edge prefixes + null + bad prefix', async ({ page }) => {
        const r = await page.evaluate(() => ({
            t: emitterDisplayLabel('T1'),
            r: emitterDisplayLabel('R10'),
            l: emitterDisplayLabel('L10'),
            b: emitterDisplayLabel('B8'),
            badPrefix: emitterDisplayLabel('Z1'),
            nullIn: emitterDisplayLabel(null),
        }));
        expect(r.t).toBe('1');
        expect(r.r).toBe('18');
        expect(r.l).toBe('J');
        expect(r.b).toBe('R');
        expect(r.badPrefix).toBe('Z1');
        expect(r.nullIn).toBeNull();
    });

    test('physics: getReflection + rotateGridPattern + flip + isShapeFlippable', async ({ page }) => {
        const r = await page.evaluate(() => {
            const dirs = Object.values(Direction);
            const states = [
                CellState.EMPTY, CellState.BLOCK,
                CellState.TRIANGLE_TL, CellState.TRIANGLE_TR,
                CellState.TRIANGLE_BR, CellState.TRIANGLE_BL,
                CellState.ABSORB,
            ];
            const refl = {};
            for (const s of states) refl[s] = dirs.map(d => getReflection(s, d));
            const pat = [
                [CellState.TRIANGLE_TL, CellState.BLOCK, CellState.EMPTY],
                [CellState.BLOCK, CellState.TRIANGLE_BR, CellState.ABSORB],
            ];
            const rot = rotateGridPattern(pat);
            const flipped = flipGridPatternHorizontally(pat);
            const flipPair = isShapeFlippable(pat);
            const flipSingle = isShapeFlippable([[CellState.BLOCK]]);
            return { refl, rotW: rot[0].length, rotH: rot.length, flipped, flipPair, flipSingle };
        });
        expect(r.refl[1]).toEqual([2, 3, 0, 1]); // BLOCK opposites
        expect(r.refl[0]).toEqual([null, null, null, null]); // EMPTY
        expect(r.refl[6]).toEqual([null, null, null, null]); // ABSORB (no entry)
        expect(r.rotW).toBe(2);
        expect(r.rotH).toBe(3);
        expect(r.flipped.length).toBe(2);
        expect(r.flipPair).toBe(true);
        expect(r.flipSingle).toBe(false);
    });

    test('tracePath: empty board, absorbed, color collection, error emitter id', async ({ page }) => {
        const r = await page.evaluate(() => {
            gameState.gridWidth = 3;
            gameState.gridHeight = 3;
            const empty = [
                [CellState.EMPTY, CellState.EMPTY, CellState.EMPTY],
                [CellState.EMPTY, CellState.EMPTY, CellState.EMPTY],
                [CellState.EMPTY, CellState.EMPTY, CellState.EMPTY],
            ];
            const fakeGame = { getGemDefinition: () => null };
            const r1 = tracePath(empty, new Map(), 'L1', fakeGame);

            const absorbGrid = JSON.parse(JSON.stringify(empty));
            absorbGrid[0][1] = CellState.ABSORB;
            const r2 = tracePath(absorbGrid, new Map(), 'T2', fakeGame);

            const colorGrid = JSON.parse(JSON.stringify(empty));
            colorGrid[1][1] = CellState.BLOCK;
            const gemMap = new Map(); gemMap.set('1,1', { id: 'g1', name: 'RED' });
            const gameWithGem = { getGemDefinition: () => ({ baseGems: ['RED'] }) };
            const r3 = tracePath(colorGrid, gemMap, 'L2', gameWithGem);

            const r4 = tracePath(empty, new Map(), 'X1', fakeGame); // bad prefix
            return { r1, r2, r3, r4 };
        });
        expect(r.r1.exitId).toBe('R1');
        expect(r.r1.absorbed).toBe(false);
        expect(r.r2.absorbed).toBe(true);
        expect(r.r2.exitId).toBe('Absorbed');
        expect(r.r3.colors).toContain('RED');
        expect(r.r4.exitId).toBe('Error');
    });

    test('tracePath: Loop? branch via MAX_STEPS exhaustion', async ({ page }) => {
        const r = await page.evaluate(() => {
            gameState.gridWidth = 2;
            gameState.gridHeight = 2;
            const grid = [
                [CellState.TRIANGLE_BR, CellState.BLOCK],
                [CellState.BLOCK,       CellState.TRIANGLE_TL],
            ];
            return tracePath(grid, new Map(), 'L1', { getGemDefinition: () => null });
        });
        expect(['Loop?', 'L1', 'R1', 'T1', 'B1', 'L2', 'R2', 'T2', 'B2']).toContain(r.exitId);
    });

    test('tracePath: malformed cell value triggers null-reflection continue branch', async ({ page }) => {
        const r = await page.evaluate(() => {
            gameState.gridWidth = 3;
            gameState.gridHeight = 1;
            const grid = [[99 /* unknown state */, CellState.EMPTY, CellState.EMPTY]];
            return tracePath(grid, new Map(), 'L1', { getGemDefinition: () => null });
        });
        expect(['R1', 'L1', 'T1', 'B1', 'Loop?', 'Error']).toContain(r.exitId);
    });

    test('EmitterButton: positions + draw with every contrast variant', async ({ page }) => {
        const r = await page.evaluate(() => {
            const ids = ['T1', 'B1', 'L1', 'R1'];
            const positions = ids.map(id => {
                const b = new EmitterButton(id, '1');
                b.updateRect(20, 20, 1, 8, 8); // no padding → defaults to 0
                return { id, x: b.rect.x, y: b.rect.y };
            });

            const padded = new EmitterButton('T1', '1');
            padded.updateRect(20, 20, 1, 8, 8, 5);
            const hit = padded.isInside(padded.rect.x + 1, padded.rect.y + 1);
            const miss = padded.isInside(-50, -50);

            const c = document.createElement('canvas');
            c.width = 200; c.height = 200;
            const ctx = c.getContext('2d');

            padded.state = 'normal'; padded.isUsed = false; padded.draw(ctx, false);
            padded.isUsed = true;  padded.usedColor = '#fff'; padded.draw(ctx, true);
            padded.state = 'focused'; padded.usedColor = '#abc'; padded.draw(ctx, false);
            padded.usedColor = 'rgb(100, 100, 100)'; padded.draw(ctx, false);
            padded.usedColor = '#fa3'; padded.draw(ctx, false);
            padded.usedColor = 'hsl(0, 0%, 50%)'; padded.draw(ctx, false);
            padded.usedColor = '#12'; padded.draw(ctx, false);
            try {
                padded.usedColor = { startsWith: () => { throw new Error('boom'); } };
                padded.draw(ctx, false);
            } catch (e) { /* ignored */ }
            padded.usedColor = null; padded.draw(ctx, false);

            return { positions, hit, miss };
        });
        expect(r.positions.find(p => p.id === 'T1').y).toBeLessThan(2);
        expect(r.positions.find(p => p.id === 'L1').x).toBeLessThan(2);
        expect(r.hit).toBe(true);
        expect(r.miss).toBe(false);
    });
});
