'use strict';

const _cellEdges = {
    [CellState.EMPTY]:       [false, false, false, false],
    [CellState.BLOCK]:       [true,  true,  true,  true],
    [CellState.ABSORB]:      [true,  true,  true,  true],
    [CellState.TRIANGLE_TL]: [true,  false, false, true],
    [CellState.TRIANGLE_TR]: [true,  true,  false, false],
    [CellState.TRIANGLE_BR]: [false, true,  true,  false],
    [CellState.TRIANGLE_BL]: [false, false, true,  true],
};

class Game {
    // Cycle order for Extreme paint: BLOCK → TL → TR → BR → BL → remove (undefined).
    static _cellCycle = {
        [CellState.BLOCK]:       CellState.TRIANGLE_TL,
        [CellState.TRIANGLE_TL]: CellState.TRIANGLE_TR,
        [CellState.TRIANGLE_TR]: CellState.TRIANGLE_BR,
        [CellState.TRIANGLE_BR]: CellState.TRIANGLE_BL,
        // TRIANGLE_BL has no successor → triggers removal.
    };

    constructor(ui) {
        this.ui = ui;
        this.secretGrid = [];
        this.secretGemMap = new Map();
        this._undoStack = [];
        this._redoStack = [];
        this.activeGames = this._loadActiveGames();
        this._persistTimer = null;
        this._manualQueryCounter = 0;
        this._customGemCounter = 0;
        this._sessionStartAt = null;
        // Drop deprecated single-game store from earlier version.
        try { localStorage.removeItem('orapa-game-v1'); } catch (e) { /* ignore */ }
        this.ui.bindGame(this);
        this.showMainMenu();
    }

    _loadActiveGames() {
        try {
            const raw = localStorage.getItem('orapa-games-v2');
            return raw ? JSON.parse(raw) : {};
        } catch (e) { return {}; }
    }

    _writeActiveGames() {
        try {
            localStorage.setItem('orapa-games-v2', JSON.stringify(this.activeGames));
        } catch (e) { /* ignore */ }
    }

    hasAnyActiveGame() {
        return Object.keys(this.activeGames).length > 0;
    }

    hasActiveGameForLevel(level) {
        return !!this.activeGames[level];
    }

    _persistCurrentGame() {
        if (!gameState.level || gameState.status !== GameStatus.PLAYING) return;
        this._flushSessionElapsed();
        this.activeGames[gameState.level] = {
            gameState: JSON.parse(JSON.stringify(gameState)),
            secretGrid: this.secretGrid,
            secretGemMap: Array.from(this.secretGemMap.entries()),
        };
        this._writeActiveGames();
    }

    _flushSessionElapsed() {
        if (this._sessionStartAt == null) return;
        const now = Date.now();
        gameState.elapsedMs = (gameState.elapsedMs || 0) + (now - this._sessionStartAt);
        this._sessionStartAt = now;
    }

    getTotalElapsedMs() {
        const base = gameState.elapsedMs || 0;
        const live = (this._sessionStartAt != null) ? (Date.now() - this._sessionStartAt) : 0;
        return base + live;
    }

    resetAllGames() {
        this.activeGames = {};
        this._writeActiveGames();
    }

    _removeCurrentGame() {
        if (!gameState.level) return;
        delete this.activeGames[gameState.level];
        this._writeActiveGames();
    }

    _snapshot() {
        return {
            playerGems: JSON.parse(JSON.stringify(gameState.playerGems)),
            blockedCells: JSON.parse(JSON.stringify(gameState.blockedCells)),
        };
    }

    _pushHistory() {
        this._undoStack.push(this._snapshot());
        if (this._undoStack.length > 100) this._undoStack.shift();
        this._redoStack = [];
        this.ui.updateUndoRedoState();
    }

    _applySnapshot(snap) {
        gameState.playerGems = JSON.parse(JSON.stringify(snap.playerGems));
        gameState.blockedCells = JSON.parse(JSON.stringify(snap.blockedCells));
        this._revalidateAllPlayerGems();
        this.updateSolutionButtonState();
        this.ui.updateToolbar();
        this.ui.redrawAll();
        this.ui.updateUndoRedoState();
    }

    undo() {
        if (this._undoStack.length === 0) return;
        this._redoStack.push(this._snapshot());
        this._applySnapshot(this._undoStack.pop());
    }

    redo() {
        if (this._redoStack.length === 0) return;
        this._undoStack.push(this._snapshot());
        this._applySnapshot(this._redoStack.pop());
    }

    canUndo() { return this._undoStack.length > 0; }
    canRedo() { return this._redoStack.length > 0; }

    _initSecretGrid() {
        this.secretGrid = this._emptyGrid();
        this.secretGemMap.clear();
    }

    _emptyGrid() {
        return Array.from({ length: gameState.gridHeight }, () => Array(gameState.gridWidth).fill(CellState.EMPTY));
    }

    _buildPlayerGrid(withGrid) {
        const grid = withGrid ? this._emptyGrid() : undefined;
        const map = new Map();
        gameState.playerGems.forEach(gem => this._paintGemOnGrid(gem, grid, map));
        return { grid, map };
    }

    _inBounds(x, y) {
        return x >= 0 && x < gameState.gridWidth && y >= 0 && y < gameState.gridHeight;
    }

    showMainMenu() {
        this._flushSessionElapsed();
        this._sessionStartAt = null;
        gameState.status = GameStatus.MAIN_MENU;
        this.ui.showScreen('main');
    }

    resume(level) {
        const saved = this.activeGames[level];
        if (!saved) return;
        Object.assign(gameState, saved.gameState);
        gameState.status = GameStatus.PLAYING;
        this.secretGrid = saved.secretGrid;
        this.secretGemMap = new Map(saved.secretGemMap);
        this._undoStack = [];
        this._redoStack = [];
        this._sessionStartAt = Date.now();
        this.ui.refreshGameUI();
        this.ui.showScreen('game');
        this.ui.redrawAll();
    }

    showLevelSelect() {
        gameState.status = GameStatus.LEVEL_SELECT;
        this.ui.showScreen('level');
    }

    showCustomCreator(mode) {
        gameState.status = GameStatus.CUSTOM_CREATOR;
        this._customCreatorMode = mode || 'custom';
        this.ui.showScreen('custom-creator');
    }

    showEndScreen(isWin) {
        this._flushSessionElapsed();
        const elapsedMs = gameState.elapsedMs || 0;
        this._sessionStartAt = null;
        gameState.status = GameStatus.GAME_OVER;
        this.ui.showEndScreen(isWin, gameState.waveCount, gameState.secretGems, gameState.playerGems, elapsedMs);
    }

    start(level, opts) {
        gameState.level = level;
        gameState.status = GameStatus.PLAYING;
        gameState.interactionMode = InteractionMode.WAVE;
        if (opts && opts.gridWidth && opts.gridHeight) {
            gameState.gridWidth = opts.gridWidth;
            gameState.gridHeight = opts.gridHeight;
        } else {
            gameState.gridWidth = GRID_WIDTH;
            gameState.gridHeight = GRID_HEIGHT;
        }

        if (level === LEVELS.GAME_SHEET) {
            this.secretGrid = [];
            this.secretGemMap = new Map();
            gameState.secretGems = [];
            gameState.customGemSet = [];
            gameState.customGemDefinitions = {};
        } else if (level === LEVELS.BOARD_CREATION) {
            // Designer mode: no secret board — the user's placement IS the board.
            this._initSecretGrid();
            gameState.secretGems = [];
        } else {
            this._initSecretGrid();
            gameState.secretGems = this._placeSecretGems();
            if (gameState.secretGems.length === 0) {
                this.showLevelSelect();
                return;
            }
        }

        gameState.playerGems = [];
        gameState.log = [];
        gameState.waveCount = 0;
        gameState.elapsedMs = 0;
        gameState.debugMode = false;
        gameState.showReflectionPath = (level === LEVELS.TRAINING);
        gameState.showPlayerPathPreview = false;
        gameState.activePlayerPath = null;
        gameState.activePlayerResult = null;
        gameState.selectedLogEntryId = null;
        gameState.previewSourceEmitterId = null;
        gameState.permanentQueryResults = [];
        gameState.blockedCells = [];
        gameState.drawSelectedColor = null;
        this._undoStack = [];
        this._redoStack = [];
        this._sessionStartAt = Date.now();

        this.ui.setupGameUI();
        this.ui.showScreen('game');
        this.ui.redrawAll();
        this._persistCurrentGame();
    }

    giveUp() {
        this._removeCurrentGame();
        this.showEndScreen(false);
    }

    toggleDebugMode() {
        gameState.debugMode = !gameState.debugMode;
        this.ui.redrawAll();
    }

    setReflectionPath(show) {
        if (gameState.showReflectionPath === show) return;
        gameState.showReflectionPath = show;
        this.ui.updatePathSwitchUI(show);
        this.ui.redrawAll();
    }

    setPlayerPathPreview(show) {
        if (gameState.showPlayerPathPreview === show) return;
        gameState.showPlayerPathPreview = show;
        this._updateActivePlayerPathPreview();
        this.ui.updatePlayerPathSwitchUI(show);
        this.ui.redrawAll();
    }

    togglePlayerPathPreview() {
        this.setPlayerPathPreview(!gameState.showPlayerPathPreview);
    }

    _updateActivePlayerPathPreview() {
        if (!gameState.showPlayerPathPreview) {
            gameState.activePlayerPath = null;
            gameState.activePlayerResult = null;
            return;
        }
        const sourceId = gameState.previewSourceEmitterId;
        const selectedLog = sourceId ? gameState.log.find(l => l.id === gameState.selectedLogEntryId) : null;
        if (!sourceId || !selectedLog || selectedLog.type !== InteractionMode.WAVE) {
            gameState.activePlayerPath = null;
            gameState.activePlayerResult = null;
            return;
        }
        const { grid, map } = this._buildPlayerGrid(true);
        const result = tracePath(grid, map, sourceId, this);
        gameState.activePlayerPath = result.path;
        gameState.activePlayerResult = result;
    }

    getGemDefinition(gemName) {
        if (gemName && gemName.startsWith('DRAWN_')) {
            const colorKey = gemName.substring('DRAWN_'.length);
            const bc = BASE_COLORS[colorKey];
            if (!bc) return null;
            return {
                name: gemName,
                color: bc.color,
                baseGems: bc.baseGems,
                special: bc.special,
                gridPattern: [[CellState.BLOCK]],
            };
        }
        const isCustom = gameState.level === LEVELS.CUSTOM;
        let definition;
        if (isCustom) {
            definition = gameState.customGemDefinitions[gemName];
        } else {
            definition = GEMS[gemName] || gameState.customGemDefinitions[gemName];
        }
        if (!definition) {
            console.error(`Could not find definition for gem: ${gemName}`);
        }
        return definition;
    }

    isExtreme() {
        return gameState.level === LEVELS.EXTREME;
    }

    isGameSheet() {
        return gameState.level === LEVELS.GAME_SHEET;
    }

    sendWave(emitterId) {
        if (gameState.status !== GameStatus.PLAYING) return;

        if (this.isGameSheet()) {
            if (gameState.interactionMode !== InteractionMode.WAVE) return;
            this.ui.openRayResultModal(emitterId, null);
            return;
        }

        if (gameState.interactionMode !== InteractionMode.WAVE) return;

        gameState.waveCount++;

        const result = tracePath(this.secretGrid, this.secretGemMap, emitterId, this);

        const { grid: playerGrid, map: playerGemMap } = this._buildPlayerGrid(true);
        const playerResult = tracePath(playerGrid, playerGemMap, emitterId, this);

        const logEntry = {
            type: InteractionMode.WAVE,
            id: emitterId,
            result,
            path: result.path,
            playerPath: playerResult.path,
            playerResult: playerResult,
        };
        gameState.log.push(logEntry);

        this.ui.addLogEntry(logEntry);
        this.setSelectedLogEntry(emitterId, emitterId);
    }

    queryCell(x, y) {
        if (gameState.interactionMode !== InteractionMode.QUERY) return;
        if (!this._inBounds(x, y)) return;

        const alreadyQueried = gameState.permanentQueryResults.some(qr => qr.coords.x === x && qr.coords.y === y);
        if (alreadyQueried) return;

        if (this.isGameSheet()) {
            this.ui.openQueryResultModal(x, y, null);
            return;
        }

        gameState.waveCount++;

        const secretGem = this.secretGemMap.get(`${y},${x}`);
        const secretResult = this.getQueryResult(secretGem);

        const alreadyHasPermanentResult = gameState.permanentQueryResults.some(qr => qr.coords.x === x && qr.coords.y === y);
        if (!alreadyHasPermanentResult) {
            gameState.permanentQueryResults.push({
                coords: { x, y },
                result: secretResult,
            });
        }

        const { map: playerGemMap } = this._buildPlayerGrid(false);
        const playerGem = playerGemMap.get(`${y},${x}`);
        const playerResult = this.getQueryResult(playerGem);

        const logEntry = {
            type: InteractionMode.QUERY,
            id: `query_${x}_${y}_${Date.now()}`,
            coords: { x, y },
            result: secretResult,
            playerResult: playerResult,
        };

        gameState.log.push(logEntry);
        this.ui.addLogEntry(logEntry);
        this.setSelectedLogEntry(logEntry.id);
        this.setInteractionMode(InteractionMode.WAVE);
    }

    commitManualWave(emitterId, exitId, colors, absorbed) {
        gameState.waveCount++;
        const logEntry = {
            type: InteractionMode.WAVE,
            id: emitterId,
            result: {
                exitId: absorbed ? 'Absorbed' : exitId,
                colors: Array.isArray(colors) ? colors.slice() : [],
                absorbed: !!absorbed,
                path: null,
            },
            path: null,
            playerPath: null,
            playerResult: null,
            manual: true,
        };
        gameState.log.push(logEntry);
        this.ui.addLogEntry(logEntry);
        this.setSelectedLogEntry(emitterId, emitterId);
        this.setInteractionMode(InteractionMode.WAVE);
        this._persistCurrentGame();
    }

    commitManualQuery(x, y, colorName, colorHex) {
        gameState.waveCount++;
        const logEntry = {
            type: InteractionMode.QUERY,
            id: `query_${x}_${y}_${++this._manualQueryCounter}`,
            coords: { x, y },
            result: { colorName, colorHex },
            playerResult: null,
            manual: true,
        };
        gameState.log.push(logEntry);
        const alreadyHasPermanent = gameState.permanentQueryResults.some(qr => qr.coords.x === x && qr.coords.y === y);
        if (!alreadyHasPermanent) {
            gameState.permanentQueryResults.push({ coords: { x, y }, result: { colorName, colorHex } });
        }
        this.ui.addLogEntry(logEntry);
        this.setSelectedLogEntry(logEntry.id);
        this.setInteractionMode(InteractionMode.WAVE);
        this._persistCurrentGame();
    }

    updateManualLogEntry(id, newFields) {
        const entry = gameState.log.find(e => e.id === id || (e.type === InteractionMode.QUERY && e.id === id));
        if (!entry) return;
        if (entry.type === InteractionMode.WAVE) {
            entry.result = {
                exitId: newFields.absorbed ? 'Absorbed' : newFields.exitId,
                colors: Array.isArray(newFields.colors) ? newFields.colors.slice() : [],
                absorbed: !!newFields.absorbed,
                path: null,
            };
        } else {
            entry.result = { colorName: newFields.colorName, colorHex: newFields.colorHex };
            if (newFields.x !== undefined && newFields.y !== undefined) {
                entry.coords = { x: newFields.x, y: newFields.y };
            }
            this._syncPermanentQueryFromLog();
        }
        this._rebuildEmittersFromLog();
        this.ui.refreshLog();
        this.ui.updateQueryCounter();
        this.ui.redrawAll();
        this._persistCurrentGame();
    }

    deleteLogEntry(id) {
        const idx = gameState.log.findIndex(e => e.id === id);
        if (idx === -1) return;
        gameState.log.splice(idx, 1);
        gameState.waveCount = Math.max(0, gameState.waveCount - 1);
        if (gameState.selectedLogEntryId === id) {
            gameState.selectedLogEntryId = null;
            gameState.previewSourceEmitterId = null;
        }
        this._syncPermanentQueryFromLog();
        this._rebuildEmittersFromLog();
        this.ui.refreshLog();
        this.ui.updateQueryCounter();
        this.ui.redrawAll();
        this._persistCurrentGame();
    }

    _syncPermanentQueryFromLog() {
        // Rebuild permanentQueryResults from current QUERY log entries — used after
        // an edit/delete to keep the canvas overlay in sync.
        const fresh = [];
        for (const entry of gameState.log) {
            if (entry.type !== InteractionMode.QUERY) continue;
            const { coords, result } = entry;
            if (!coords) continue;
            if (fresh.some(qr => qr.coords.x === coords.x && qr.coords.y === coords.y)) continue;
            fresh.push({ coords: { x: coords.x, y: coords.y }, result: Object.assign({}, result) });
        }
        gameState.permanentQueryResults = fresh;
    }

    _rebuildEmittersFromLog() {
        const r = this.ui.renderer;
        r.setupEmitters();
        r.emitters.forEach(em => em.updateRect(r.cellWidth, r.cellHeight, r.gap, gameState.gridWidth, gameState.gridHeight, r.outerPadding));
        for (const entry of gameState.log) {
            if (entry.type === InteractionMode.WAVE) {
                this.ui.renderer.updateEmitterFromLog(entry);
            }
        }
    }

    finishGameSheet() {
        this._removeCurrentGame();
        this.showMainMenu();
    }

    addGameSheetCustomGem(colorKey, shapeKey, customDesignedShape) {
        const shapeDef = (shapeKey === 'SHAPE_CUSTOM_DESIGN' && customDesignedShape)
            ? Object.assign({}, customDesignedShape, { name: CUSTOM_SHAPES.SHAPE_CUSTOM_DESIGN.name })
            : CUSTOM_SHAPES[shapeKey];
        if (!shapeDef || !shapeDef.gridPattern) return null;
        const colorDef = BASE_COLORS[colorKey];
        if (!colorDef) return null;

        const finalGridPattern = (colorKey === 'BLACK')
            ? shapeDef.gridPattern.map(row => row.map(c => (c !== CellState.EMPTY ? CellState.ABSORB : CellState.EMPTY)))
            : shapeDef.gridPattern.map(row => row.map(c => (c === CellState.ABSORB ? CellState.BLOCK : c)));

        const gemName = `CUSTOM_${colorKey}_${shapeKey}_${++this._customGemCounter}`;
        const newGemDef = Object.assign({}, colorDef, shapeDef, {
            gridPattern: finalGridPattern,
            name: gemName,
            originalColorKey: colorKey,
        });
        gameState.customGemDefinitions[gemName] = newGemDef;
        gameState.customGemSet.push(gemName);
        this.ui.updateToolbar();
        this._persistCurrentGame();
        return gemName;
    }

    removeGameSheetCustomGem(gemName) {
        const idx = gameState.customGemSet.indexOf(gemName);
        if (idx === -1) return;
        gameState.customGemSet.splice(idx, 1);
        delete gameState.customGemDefinitions[gemName];
        // Drop any placed instances of this gem.
        gameState.playerGems = gameState.playerGems.filter(g => g.name !== gemName);
        this.ui.updateToolbar();
        this.ui.redrawAll();
        this._persistCurrentGame();
    }

    // ===== Shareable boards ("Play against Friends") =====

    isShareableLevel(level) {
        // Game Sheet has no secret board; everything else is shareable.
        return level && level !== LEVELS.GAME_SHEET;
    }

    isBoardCreation() {
        return gameState.level === LEVELS.BOARD_CREATION;
    }

    startBoardCreation(opts, gemSet, gemDefinitions) {
        gameState.customGemSet = Array.isArray(gemSet) ? gemSet.slice() : [];
        gameState.customGemDefinitions = Object.assign({}, gemDefinitions || {});
        this.start(LEVELS.BOARD_CREATION, opts);
    }

    _b64urlEncode(str) {
        const b64 = btoa(unescape(encodeURIComponent(str)));
        return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    _b64urlDecode(b64url) {
        let s = b64url.replace(/-/g, '+').replace(/_/g, '/');
        while (s.length % 4) s += '=';
        return decodeURIComponent(escape(atob(s)));
    }

    _encodeBoard(level, w, h, gems, customDefs) {
        // Compact tuple-of-tuples so the game ID stays short.
        // [name, x, y, rotationQuarter (0..3), isFlipped (0|1)]
        const g = gems.map(gem => [gem.name, gem.x, gem.y, ((gem.rotation || 0) / 90) % 4, gem.isFlipped ? 1 : 0]);
        const payload = { v: 3, l: level, w, h, g };
        if (customDefs && Object.keys(customDefs).length > 0) {
            // Compact: { name: [originalColorKey, gridPattern] }
            payload.d = Object.fromEntries(
                Object.entries(customDefs).map(([name, def]) => [name, [def.originalColorKey, def.gridPattern]])
            );
        }
        return this._b64urlEncode(JSON.stringify(payload));
    }

    _decodeBoard(gameId) {
        const payload = JSON.parse(this._b64urlDecode(gameId));
        if (!payload || (payload.v !== 2 && payload.v !== 3)) throw new Error('Unsupported game ID version');
        if (!payload.l || !payload.w || !payload.h || !Array.isArray(payload.g)) throw new Error('Malformed game ID');
        if (!LEVELS[payload.l]) throw new Error(`Unknown level in game ID: ${payload.l}`);

        const customDefs = {};
        if (payload.d) {
            for (const [name, tuple] of Object.entries(payload.d)) {
                const [colorKey, pattern] = tuple;
                const colorDef = BASE_COLORS[colorKey];
                if (!colorDef) throw new Error(`Unknown color in game ID: ${colorKey}`);
                customDefs[name] = Object.assign({}, colorDef, {
                    gridPattern: pattern,
                    name,
                    originalColorKey: colorKey,
                });
            }
        }

        const gems = payload.g.map((tuple, i) => {
            const [name, x, y, r, f] = tuple;
            const gemDef = GEMS[name] || customDefs[name];
            if (!gemDef) throw new Error(`Unknown gem in game ID: ${name}`);
            let pattern = gemDef.gridPattern;
            const isFlippable = isShapeFlippable(pattern);
            if (f) pattern = flipGridPatternHorizontally(pattern);
            for (let k = 0; k < (r % 4); k++) pattern = rotateGridPattern(pattern);
            return {
                id: `secret_${name}_${i}`,
                name, x, y,
                rotation: (r % 4) * 90,
                isFlipped: !!f,
                isFlippable,
                gridPattern: pattern,
            };
        });
        return { level: payload.l, w: payload.w, h: payload.h, gems, customDefs };
    }

    getCurrentGameId() {
        if (!this.isShareableLevel(gameState.level)) return null;

        if (this.isBoardCreation()) {
            // Designer mode: share the placement the user is creating. Recipient plays it as CUSTOM.
            if (!gameState.playerGems || gameState.playerGems.length === 0) return null;
            const usedDefs = {};
            for (const gem of gameState.playerGems) {
                if (!GEMS[gem.name] && gameState.customGemDefinitions[gem.name]) {
                    usedDefs[gem.name] = gameState.customGemDefinitions[gem.name];
                }
            }
            return this._encodeBoard(LEVELS.CUSTOM, gameState.gridWidth, gameState.gridHeight, gameState.playerGems, usedDefs);
        }

        if (!gameState.secretGems || gameState.secretGems.length === 0) return null;
        const usedDefs = {};
        if (gameState.level === LEVELS.CUSTOM) {
            for (const gem of gameState.secretGems) {
                if (!GEMS[gem.name] && gameState.customGemDefinitions[gem.name]) {
                    usedDefs[gem.name] = gameState.customGemDefinitions[gem.name];
                }
            }
        }
        return this._encodeBoard(gameState.level, gameState.gridWidth, gameState.gridHeight, gameState.secretGems, usedDefs);
    }

    gameShareUrl(gameId) {
        const base = `${window.location.origin}${window.location.pathname}`;
        return `${base}?mode=play&game-id=${gameId}`;
    }

    startSharedGameFromId(gameId) {
        let decoded;
        try { decoded = this._decodeBoard(gameId); }
        catch (e) {
            alert('This game ID is invalid or corrupted.');
            console.error(e);
            this.showMainMenu();
            return;
        }

        gameState.level = decoded.level;
        gameState.status = GameStatus.PLAYING;
        gameState.interactionMode = InteractionMode.WAVE;
        gameState.gridWidth = decoded.w;
        gameState.gridHeight = decoded.h;

        // Restore any custom gem definitions carried in the payload so the toolbar
        // and renderer can resolve them by name.
        if (decoded.customDefs && Object.keys(decoded.customDefs).length > 0) {
            gameState.customGemDefinitions = Object.assign({}, decoded.customDefs);
            gameState.customGemSet = Object.keys(decoded.customDefs);
        } else if (decoded.level !== LEVELS.CUSTOM) {
            gameState.customGemDefinitions = {};
            gameState.customGemSet = [];
        }

        this._initSecretGrid();
        gameState.secretGems = decoded.gems;
        gameState.secretGems.forEach(gem => this._paintGemOnGrid(gem, this.secretGrid, this.secretGemMap));

        gameState.playerGems = [];
        gameState.log = [];
        gameState.waveCount = 0;
        gameState.elapsedMs = 0;
        gameState.debugMode = false;
        gameState.showReflectionPath = (decoded.level === LEVELS.TRAINING);
        gameState.showPlayerPathPreview = false;
        gameState.activePlayerPath = null;
        gameState.activePlayerResult = null;
        gameState.selectedLogEntryId = null;
        gameState.previewSourceEmitterId = null;
        gameState.permanentQueryResults = [];
        gameState.blockedCells = [];
        gameState.drawSelectedColor = null;
        this._undoStack = [];
        this._redoStack = [];
        this._sessionStartAt = Date.now();

        this.ui.setupGameUI();
        this.ui.showScreen('game');
        this.ui.redrawAll();
        this._persistCurrentGame();
    }

    getQueryResult(gem) {
        const EMPTY_RESULT = { colorName: 'Empty', colorHex: null };
        if (!gem) return EMPTY_RESULT;
        const gemDef = this.getGemDefinition(gem.name);
        if (!gemDef) return EMPTY_RESULT;

        if (gemDef.special === 'absorbs') {
            return { colorName: BASE_COLORS.BLACK.name, colorHex: gemDef.color };
        }
        if (gemDef.baseGems.length === 0) {
            return { colorName: BASE_COLORS.TRANSPARENT.name, colorHex: gemDef.color };
        }
        if (gemDef.baseGems.length === 1) {
            const baseColor = BASE_COLORS[gemDef.baseGems[0]];
            if (!baseColor) return EMPTY_RESULT;
            return { colorName: baseColor.name, colorHex: gemDef.color };
        }
        const key = colorComboKey(gemDef.baseGems);
        const colorName = COLOR_COMBO_NAMES[key] || 'Mix';
        const colorHex = COLOR_MIXING[key] || gemDef.color;
        return { colorName, colorHex };
    }

    checkSolution() {
        const { grid: playerGrid, map: playerGemMap } = this._buildPlayerGrid(true);

        const allEmitterIds = [];
        for (let i = 1; i <= gameState.gridWidth; i++) {
            allEmitterIds.push(`T${i}`, `B${i}`);
        }
        for (let i = 1; i <= gameState.gridHeight; i++) {
            allEmitterIds.push(`L${i}`, `R${i}`);
        }

        let isCorrect = true;
        for (const emitterId of allEmitterIds) {
            const secretResult = tracePath(this.secretGrid, this.secretGemMap, emitterId, this);
            const playerResult = tracePath(playerGrid, playerGemMap, emitterId, this);

            if (secretResult.exitId !== playerResult.exitId ||
                colorComboKey(secretResult.colors) !== colorComboKey(playerResult.colors)) {
                isCorrect = false;
                break;
            }
        }

        this._removeCurrentGame();
        this.showEndScreen(isCorrect);
    }

    addPlayerGem(gemName, x, y) {
        const alreadyPlaced = gameState.playerGems.some(gem => gem.name === gemName);
        if (alreadyPlaced) return;

        const gemDef = this.getGemDefinition(gemName);
        if (!gemDef) return;

        this._pushHistory();
        const pattern = gemDef.gridPattern;

        const newGem = {
            id: `player_${Date.now()}`,
            name: gemName,
            x, y,
            rotation: 0,
            isFlipped: false,
            isFlippable: isShapeFlippable(pattern),
            gridPattern: pattern,
            isValid: false,
        };

        const height = newGem.gridPattern.length;
        const width = newGem.gridPattern[0].length;
        newGem.x = Math.max(0, Math.min(x, gameState.gridWidth - width));
        newGem.y = Math.max(0, Math.min(y, gameState.gridHeight - height));

        gameState.playerGems.push(newGem);
        this._revalidateAllPlayerGems();

        this.updateSolutionButtonState();
        this.ui.updateToolbar();
        this.ui.redrawAll();
    }

    movePlayerGem(id, newX, newY) {
        const gem = gameState.playerGems.find(g => g.id === id);
        if (gem) {
            const height = gem.gridPattern.length;
            const width = gem.gridPattern[0].length;
            const clampedX = Math.max(0, Math.min(newX, gameState.gridWidth - width));
            const clampedY = Math.max(0, Math.min(newY, gameState.gridHeight - height));
            if (clampedX === gem.x && clampedY === gem.y) return;

            this._pushHistory();
            gem.x = clampedX;
            gem.y = clampedY;

            this._revalidateAllPlayerGems();
            this.updateSolutionButtonState();
            this.ui.redrawAll();
        }
    }

    removePlayerGem(id) {
        const gemIndex = gameState.playerGems.findIndex(g => g.id === id);
        if (gemIndex > -1) {
            this._pushHistory();
            gameState.playerGems.splice(gemIndex, 1);
            this._revalidateAllPlayerGems();
            this.updateSolutionButtonState();
            this.ui.updateToolbar();
            this.ui.redrawAll();
        }
    }

    rotatePlayerGem(id) {
        const gem = gameState.playerGems.find(g => g.id === id);
        if (gem) {
            this._pushHistory();
            const oldWidth = gem.gridPattern[0].length;
            const oldHeight = gem.gridPattern.length;

            const centerX = gem.x + oldWidth / 2;
            const centerY = gem.y + oldHeight / 2;

            gem.rotation = (gem.rotation + 90) % 360;
            gem.gridPattern = rotateGridPattern(gem.gridPattern);
            const newWidth = gem.gridPattern[0].length;
            const newHeight = gem.gridPattern.length;

            gem.x = Math.round(centerX - newWidth / 2);
            gem.y = Math.round(centerY - newHeight / 2);

            gem.x = Math.max(0, Math.min(gem.x, gameState.gridWidth - newWidth));
            gem.y = Math.max(0, Math.min(gem.y, gameState.gridHeight - newHeight));

            this._revalidateAllPlayerGems();
            this.updateSolutionButtonState();
            this.ui.redrawAll();
        }
    }

    flipPlayerGem(id) {
        const gem = gameState.playerGems.find(g => g.id === id);
        if (gem && gem.isFlippable) {
            this._pushHistory();
            gem.isFlipped = !gem.isFlipped;
            gem.gridPattern = flipGridPatternHorizontally(gem.gridPattern);
            this._revalidateAllPlayerGems();
            this.updateSolutionButtonState();
            this.ui.redrawAll();
        }
    }

    canPlaceGem(gemToTest) {
        return this._isPlacementValid(gemToTest, gameState.playerGems);
    }

    toggleBlockedCell(x, y) {
        if (!this._inBounds(x, y)) return;

        const index = gameState.blockedCells.findIndex(c => c.x === x && c.y === y);
        if (index > -1) {
            this._pushHistory();
            gameState.blockedCells.splice(index, 1);
        } else {
            const isOccupied = gameState.playerGems.some(gem => {
                for (let r = 0; r < gem.gridPattern.length; r++) {
                    for (let c = 0; c < gem.gridPattern[r].length; c++) {
                        if (gem.gridPattern[r][c] !== CellState.EMPTY && gem.x + c === x && gem.y + r === y) {
                            return true;
                        }
                    }
                }
                return false;
            });
            if (isOccupied) return;
            this._pushHistory();
            gameState.blockedCells.push({ x, y });
        }
        this._revalidateAllPlayerGems();
        this.ui.redrawAll();
    }

    setDrawColor(colorKey) {
        gameState.drawSelectedColor = (gameState.drawSelectedColor === colorKey) ? null : colorKey;
        this.ui.updateDrawColorUI();
    }

    paintCell(x, y) {
        if (!this.isExtreme()) return;
        if (!this._inBounds(x, y)) return;
        const colorKey = gameState.drawSelectedColor;
        if (!colorKey) return;

        const gemName = `DRAWN_${colorKey}`;
        const idx = gameState.playerGems.findIndex(g =>
            g.name && g.name.startsWith('DRAWN_') && g.x === x && g.y === y);
        const initialState = (colorKey === 'BLACK') ? CellState.ABSORB : CellState.BLOCK;

        this._pushHistory();

        if (idx === -1) {
            gameState.playerGems.push({
                id: `drawn_${x}_${y}_${Date.now()}`,
                name: gemName,
                x, y,
                rotation: 0,
                isFlipped: false,
                isFlippable: false,
                gridPattern: [[initialState]],
                isValid: true,
            });
        } else {
            const existing = gameState.playerGems[idx];
            if (existing.name !== gemName) {
                // Different color → reset to that color's base cell
                existing.name = gemName;
                existing.gridPattern = [[initialState]];
            } else if (colorKey === 'BLACK') {
                // Black has no triangle variants, so cycle is just ABSORB→remove
                gameState.playerGems.splice(idx, 1);
            } else {
                // Same colored cell → cycle BLOCK→TL→TR→BR→BL→remove
                const next = Game._cellCycle[existing.gridPattern[0][0]];
                if (next === undefined) gameState.playerGems.splice(idx, 1);
                else existing.gridPattern = [[next]];
            }
        }

        this.updateSolutionButtonState();
        this.ui.redrawAll();
    }

    setInteractionMode(mode) {
        if (gameState.interactionMode !== mode) {
            gameState.interactionMode = mode;
            this.ui.updateInteractionModeUI(mode);
            this.ui.redrawAll();
        }
    }

    setSelectedLogEntry(id, sourceEmitterId) {
        gameState.selectedLogEntryId = id;

        if (id === null) {
            gameState.previewSourceEmitterId = null;
        } else {
            const logEntry = gameState.log.find(l => l.id === id);
            if (logEntry && logEntry.type === InteractionMode.WAVE) {
                gameState.previewSourceEmitterId = sourceEmitterId || logEntry.id;
            } else {
                gameState.previewSourceEmitterId = null;
            }
        }

        this._updateActivePlayerPathPreview();
        this.ui.handleSelectionChange();
    }

    _revalidateAllPlayerGems() {
        gameState.playerGems.forEach(gem => {
            gem.isValid = this._isPlacementValid(gem, gameState.playerGems);
        });
        this._updateActivePlayerPathPreview();
    }

    _doGemsCollide(gemA, gemB) {
        const heightA = gemA.gridPattern.length;
        const widthA = gemA.gridPattern[0].length;
        const heightB = gemB.gridPattern.length;
        const widthB = gemB.gridPattern[0].length;

        const gemDefA = this.getGemDefinition(gemA.name);
        const gemDefB = this.getGemDefinition(gemB.name);
        const isAbsorberInvolved = (gemDefA && gemDefA.special === 'absorbs') || (gemDefB && gemDefB.special === 'absorbs');

        for (let rA = 0; rA < heightA; rA++) {
            for (let cA = 0; cA < widthA; cA++) {
                const cellAState = gemA.gridPattern[rA][cA];
                if (cellAState === CellState.EMPTY) continue;

                const worldXA = gemA.x + cA;
                const worldYA = gemA.y + rA;

                for (let rB = 0; rB < heightB; rB++) {
                    for (let cB = 0; cB < widthB; cB++) {
                        const cellBState = gemB.gridPattern[rB][cB];
                        if (cellBState === CellState.EMPTY) continue;

                        const worldXB = gemB.x + cB;
                        const worldYB = gemB.y + rB;

                        const dx = Math.abs(worldXA - worldXB);
                        const dy = Math.abs(worldYA - worldYB);

                        if (isAbsorberInvolved) {
                            if (dx <= 1 && dy <= 1) {
                                return true;
                            }
                        } else {
                            if (dx === 0 && dy === 0) {
                                return true;
                            }
                            if (dx + dy === 1) {
                                const edgesA = _cellEdges[cellAState];
                                const edgesB = _cellEdges[cellBState];

                                if (worldXA < worldXB) {
                                    if (edgesA[1] && edgesB[3]) return true;
                                } else if (worldXA > worldXB) {
                                    if (edgesA[3] && edgesB[1]) return true;
                                } else if (worldYA < worldYB) {
                                    if (edgesA[2] && edgesB[0]) return true;
                                } else {
                                    if (edgesA[0] && edgesB[2]) return true;
                                }
                            }
                        }
                    }
                }
            }
        }
        return false;
    }

    _isPlacementValid(gemToTest, allPlacedGems) {
        const { gridPattern, x, y, id } = gemToTest;
        const height = gridPattern.length;
        const width = gridPattern[0].length;

        if (x < 0 || y < 0 || x + width > gameState.gridWidth || y + height > gameState.gridHeight) {
            return false;
        }

        for (let r = 0; r < height; r++) {
            for (let c = 0; c < width; c++) {
                if (gridPattern[r][c] !== CellState.EMPTY) {
                    const cellX = x + c;
                    const cellY = y + r;
                    if (gameState.blockedCells.some(bc => bc.x === cellX && bc.y === cellY)) {
                        return false;
                    }
                }
            }
        }

        for (const otherGem of allPlacedGems) {
            if (id && otherGem.id === id) continue;
            if (this._doGemsCollide(gemToTest, otherGem)) {
                return false;
            }
        }
        return true;
    }

    _paintGemOnGrid(gem, grid, gemMap) {
        const { gridPattern, x, y } = gem;
        for (let r = 0; r < gridPattern.length; r++) {
            for (let c = 0; c < gridPattern[r].length; c++) {
                const cellState = gridPattern[r][c];
                if (cellState !== CellState.EMPTY) {
                    if (grid && grid[y + r] && grid[y + r][x + c] !== undefined) {
                        grid[y + r][x + c] = cellState;
                    }
                    if (gemMap) {
                        gemMap.set(`${y + r},${x + c}`, gem);
                    }
                }
            }
        }
    }

    updateSolutionButtonState() {
        if (this.isGameSheet() || this.isBoardCreation()) return;
        if (this.isExtreme()) {
            // In Extreme, accept any non-empty drawing.
            this.ui.checkSolutionBtn.disabled = gameState.playerGems.length === 0;
            return;
        }
        const isCustom = gameState.level === LEVELS.CUSTOM;
        const requiredCount = isCustom
            ? gameState.customGemSet.length
            : (GEM_SETS[gameState.level] ? GEM_SETS[gameState.level].length : 0);

        const allValid = gameState.playerGems.every(gem => gem.isValid);
        const correctCount = gameState.playerGems.length === requiredCount;
        this.ui.checkSolutionBtn.disabled = !(allValid && correctCount);
    }

    _placeSecretGems() {
        const placedGems = [];
        const isCustom = gameState.level === LEVELS.CUSTOM;
        const gemSet = isCustom ? gameState.customGemSet : GEM_SETS[gameState.level];

        if (!gemSet || gemSet.length === 0) {
            console.error("Gem set is empty for level:", gameState.level);
            return [];
        }

        let attempts = 0;

        while (placedGems.length < gemSet.length && attempts < 500) {
            attempts++;
            placedGems.length = 0;

            for (const gemName of gemSet) {
                const gemDef = this.getGemDefinition(gemName);
                if (!gemDef) continue;

                let placed = false;
                let singleGemAttempts = 0;

                while (!placed && singleGemAttempts < 200) {
                    singleGemAttempts++;

                    const isFlippable = isShapeFlippable(gemDef.gridPattern);
                    const shouldFlip = isFlippable && Math.random() < 0.5;

                    let pattern = gemDef.gridPattern;
                    if (shouldFlip) {
                        pattern = flipGridPatternHorizontally(pattern);
                    }

                    const rotCount = Math.floor(Math.random() * 4);
                    for (let i = 0; i < rotCount; i++) pattern = rotateGridPattern(pattern);

                    const effH = pattern.length;
                    const effW = pattern[0].length;

                    if (gameState.gridWidth < effW || gameState.gridHeight < effH) continue;

                    const x = Math.floor(Math.random() * (gameState.gridWidth - effW + 1));
                    const y = Math.floor(Math.random() * (gameState.gridHeight - effH + 1));

                    const newGem = {
                        id: `secret_${gemName}_${placedGems.length}`,
                        name: gemName, x, y, rotation: rotCount * 90,
                        isFlipped: shouldFlip,
                        isFlippable: isFlippable,
                        gridPattern: pattern,
                    };

                    if (this._isPlacementValid(newGem, placedGems)) {
                        placedGems.push(newGem);
                        placed = true;
                    }
                }
                if (!placed) break;
            }
        }

        if (placedGems.length !== gemSet.length) {
            console.error("Failed to place all secret gems!");
            alert("Error generating level. Please try again.");
            return [];
        }

        placedGems.forEach(gem => this._paintGemOnGrid(gem, this.secretGrid, this.secretGemMap));
        return placedGems;
    }
}
