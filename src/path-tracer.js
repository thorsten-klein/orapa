'use strict';

const _MAX_STEPS = 100;

function _getEmitterDetails(emitterId) {
    const idNum = parseInt(emitterId.substring(1)) - 1;
    switch (emitterId[0]) {
        case 'T': return { pos: { x: idNum, y: -1 }, dir: Direction.DOWN };
        case 'B': return { pos: { x: idNum, y: gameState.gridHeight }, dir: Direction.UP };
        case 'L': return { pos: { x: -1, y: idNum }, dir: Direction.RIGHT };
        case 'R': return { pos: { x: gameState.gridWidth, y: idNum }, dir: Direction.LEFT };
        default: return null;
    }
}

function _getExitId(pos) {
    if (pos.y < 0) return `T${pos.x + 1}`;
    if (pos.y >= gameState.gridHeight) return `B${pos.x + 1}`;
    if (pos.x < 0) return `L${pos.y + 1}`;
    return `R${pos.y + 1}`; // pos.x >= gameState.gridWidth is the only remaining case
}

function _movePos(pos, dir) {
    switch (dir) {
        case Direction.UP: pos.y--; break;
        case Direction.DOWN: pos.y++; break;
        case Direction.LEFT: pos.x--; break;
        case Direction.RIGHT: pos.x++; break;
    }
}

function tracePath(grid, gemMap, emitterId, game) {
    const startDetails = _getEmitterDetails(emitterId);
    if (!startDetails) {
        return { exitId: 'Error', colors: [], path: [], absorbed: false };
    }

    const currentPos = Object.assign({}, startDetails.pos);
    let currentDir = startDetails.dir;

    const path = [];
    const hitColors = new Set();
    const hitGems = new Set();

    for (let step = 0; step < _MAX_STEPS; step++) {
        _movePos(currentPos, currentDir);

        if (path.length === 0) {
            path.push({
                x: startDetails.pos.x + (startDetails.dir === Direction.RIGHT ? 1 : startDetails.dir === Direction.LEFT ? 0 : 0.5),
                y: startDetails.pos.y + (startDetails.dir === Direction.DOWN ? 1 : startDetails.dir === Direction.UP ? 0 : 0.5),
            });
        }

        if (
            currentPos.x < 0 || currentPos.x >= gameState.gridWidth ||
            currentPos.y < 0 || currentPos.y >= gameState.gridHeight
        ) {
            path.push({
                x: currentPos.x + (currentDir === Direction.LEFT ? 1 : currentDir === Direction.RIGHT ? 0 : 0.5),
                y: currentPos.y + (currentDir === Direction.UP ? 1 : currentDir === Direction.DOWN ? 0 : 0.5),
            });
            return { exitId: _getExitId(currentPos), colors: Array.from(hitColors), path, absorbed: false };
        }

        const cellState = grid[currentPos.y][currentPos.x];

        if (cellState === CellState.EMPTY) {
            continue;
        }

        path.push({ x: currentPos.x + 0.5, y: currentPos.y + 0.5 });

        const gemKey = `${currentPos.y},${currentPos.x}`;
        const hitGem = gemMap.get(gemKey);
        if (hitGem && !hitGems.has(hitGem.id)) {
            hitGems.add(hitGem.id);
            const gemDef = game.getGemDefinition(hitGem.name);
            if (gemDef && gemDef.baseGems) {
                gemDef.baseGems.forEach(c => hitColors.add(c));
            }
        }

        if (cellState === CellState.ABSORB) {
            return { exitId: 'Absorbed', colors: [], path, absorbed: true };
        }

        const newDir = getReflection(cellState, currentDir);
        if (newDir === null) {
            continue;
        }

        currentDir = newDir;
    }

    return { exitId: 'Loop?', colors: Array.from(hitColors), path, absorbed: false };
}
