'use strict';

const Direction = {
    UP: 0,
    RIGHT: 1,
    DOWN: 2,
    LEFT: 3,
};

const _reflectionMap = {
    [CellState.BLOCK]: {
        [Direction.UP]: Direction.DOWN,
        [Direction.RIGHT]: Direction.LEFT,
        [Direction.DOWN]: Direction.UP,
        [Direction.LEFT]: Direction.RIGHT,
    },
    [CellState.TRIANGLE_TR]: {
        [Direction.UP]: Direction.LEFT,
        [Direction.RIGHT]: Direction.DOWN,
        [Direction.DOWN]: Direction.UP,
        [Direction.LEFT]: Direction.RIGHT,
    },
    [CellState.TRIANGLE_BL]: {
        [Direction.UP]: Direction.DOWN,
        [Direction.RIGHT]: Direction.LEFT,
        [Direction.DOWN]: Direction.RIGHT,
        [Direction.LEFT]: Direction.UP,
    },
    [CellState.TRIANGLE_TL]: {
        [Direction.UP]: Direction.RIGHT,
        [Direction.RIGHT]: Direction.LEFT,
        [Direction.DOWN]: Direction.UP,
        [Direction.LEFT]: Direction.DOWN,
    },
    [CellState.TRIANGLE_BR]: {
        [Direction.UP]: Direction.DOWN,
        [Direction.RIGHT]: Direction.UP,
        [Direction.DOWN]: Direction.LEFT,
        [Direction.LEFT]: Direction.RIGHT,
    },
};

const _rotationMap = {
    [CellState.EMPTY]: CellState.EMPTY,
    [CellState.BLOCK]: CellState.BLOCK,
    [CellState.ABSORB]: CellState.ABSORB,
    [CellState.TRIANGLE_TL]: CellState.TRIANGLE_TR,
    [CellState.TRIANGLE_TR]: CellState.TRIANGLE_BR,
    [CellState.TRIANGLE_BR]: CellState.TRIANGLE_BL,
    [CellState.TRIANGLE_BL]: CellState.TRIANGLE_TL,
};

const _flipMap = {
    [CellState.EMPTY]: CellState.EMPTY,
    [CellState.BLOCK]: CellState.BLOCK,
    [CellState.ABSORB]: CellState.ABSORB,
    [CellState.TRIANGLE_TL]: CellState.TRIANGLE_TR,
    [CellState.TRIANGLE_TR]: CellState.TRIANGLE_TL,
    [CellState.TRIANGLE_BR]: CellState.TRIANGLE_BL,
    [CellState.TRIANGLE_BL]: CellState.TRIANGLE_BR,
};

function getReflection(cell, dir) {
    if (cell === CellState.EMPTY) {
        return null;
    }
    const mapEntry = _reflectionMap[cell];
    if (!mapEntry) return null;
    const newDir = mapEntry[dir];
    return newDir === undefined ? null : newDir;
}

function rotateGridPattern(pattern) {
    const rows = pattern.length;
    const cols = pattern[0].length;
    const newPattern = Array.from({ length: cols }, () => Array(rows).fill(CellState.EMPTY));

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            newPattern[c][rows - 1 - r] = _rotationMap[pattern[r][c]];
        }
    }
    return newPattern;
}

function flipGridPatternHorizontally(pattern) {
    return pattern.map(row =>
        row.map(cellState => _flipMap[cellState]).reverse()
    );
}

function isShapeFlippable(pattern) {
    const flipped = flipGridPatternHorizontally(pattern);
    const flippedStr = JSON.stringify(flipped);

    let current = pattern;
    for (let i = 0; i < 4; i++) {
        if (JSON.stringify(current) === flippedStr) {
            return false;
        }
        current = rotateGridPattern(current);
    }

    return true;
}
