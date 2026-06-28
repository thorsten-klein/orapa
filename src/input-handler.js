'use strict';

class InputHandler {
    constructor(game, ui) {
        this.game = game;
        this.ui = ui;
        this.renderer = null;

        this.gemCanvas = document.getElementById('gem-canvas');
        this.logList = document.getElementById('log-list');

        this.dragStartInfo = null;
        this.isDragging = false;
        this.draggedItemInfo = null;
        this.dragPos = { x: 0, y: 0 };
        this.lastValidDropTarget = { x: -1, y: -1, isValid: false };
        this.hoveredGridCell = null;
        this.focusedEmitterId = null;

        this.longPressTimeout = null;
        this.longPressTriggered = false;

        // Swipe-to-paint-X state: set when a press starts on an empty grid cell
        // in WAVE mode and tracks which cells the pointer has visited so each
        // is painted exactly once with the same blocked-state per stroke.
        this.blockPaintInfo = null;

        this.bindEvents();
    }

    connectRenderer(renderer) {
        this.renderer = renderer;
    }

    bindEvents() {
        document.addEventListener('click', (e) => this.handleGlobalClick(e));
        this.logList.addEventListener('click', (e) => this.handleLogClick(e));

        this.gemCanvas.addEventListener('keydown', (e) => this.handleCanvasKeyDown(e));
        this.gemCanvas.addEventListener('mousemove', (e) => this.handleCanvasHover(e.clientX, e.clientY));
        this.gemCanvas.addEventListener('mouseleave', () => this.handleCanvasMouseLeave());

        document.addEventListener('mousedown', (e) => this.handlePointerDown(e));
        document.addEventListener('touchstart', (e) => this.handlePointerDown(e), { passive: false });
        document.addEventListener('mousemove', (e) => this.handlePointerMove(e));
        document.addEventListener('touchmove', (e) => this.handlePointerMove(e), { passive: false });
        document.addEventListener('mouseup', (e) => this.handlePointerUp(e));
        document.addEventListener('touchend', (e) => this.handlePointerUp(e));
    }

    getPointerCoordinates(e) {
        if (e instanceof MouseEvent) {
            return { clientX: e.clientX, clientY: e.clientY };
        }
        if (e.changedTouches && e.changedTouches.length > 0) {
            return { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY };
        }
        return null;
    }

    handleGlobalClick(e) {
        if (!gameState.selectedLogEntryId) return;
        const target = e.target;
        const isInteractive = target.closest('#gem-canvas') || target.closest('#log-list li');
        if (!isInteractive) {
            this.game.setSelectedLogEntry(null);
        }
    }

    handleLogClick(e) {
        const li = e.target.closest('li');
        if (li && li.dataset.logId) {
            const logId = li.dataset.logId;
            if (gameState.selectedLogEntryId === logId) {
                this.game.setSelectedLogEntry(null);
            } else {
                const logEntry = gameState.log.find(l => l.id === logId);
                const sourceEmitterId = (logEntry && logEntry.type === InteractionMode.WAVE) ? logEntry.id : undefined;
                this.game.setSelectedLogEntry(logId, sourceEmitterId);
            }
        }
    }

    handleCanvasHover(clientX, clientY) {
        if (this.isDragging || !this.renderer) return;

        const rect = this.gemCanvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        this.dragPos = { x, y };

        if (gameState.interactionMode === InteractionMode.QUERY) {
            const gridCoords = this.renderer._canvasToGridCoords(x, y);
            const isOverGrid = this.game._inBounds(gridCoords.x, gridCoords.y);
            this.gemCanvas.style.cursor = isOverGrid ? 'crosshair' : 'default';
            this.hoveredGridCell = isOverGrid ? gridCoords : null;
        } else {
            this.hoveredGridCell = null;
            const gem = this.getGemAtCanvasPos(x, y);
            const emitter = this.renderer.emitters.find(em => em.isInside(x, y));
            this.gemCanvas.style.cursor = (gem || emitter) ? 'pointer' : 'default';
        }

        this.ui.redrawAll();
    }

    handleCanvasMouseLeave() {
        this.dragPos = { x: -1, y: -1 };
        this.hoveredGridCell = null;
        this.gemCanvas.style.cursor = 'default';
        this.ui.redrawAll();
    }

    handlePointerDown(e) {
        if (e instanceof MouseEvent && e.button !== 0) return;
        const coords = this.getPointerCoordinates(e);
        if (!coords) return;
        const { clientX, clientY } = coords;
        const target = e.target;
        const toolbarGemEl = target.closest('.toolbar-gem:not(.placed):not(.toolbar-gem-add)');
        const isOverCanvas = target.closest('#gem-canvas');

        if ('touches' in e && (isOverCanvas || toolbarGemEl)) {
            e.preventDefault();
        }

        let potentialDragItem = null;

        if (toolbarGemEl) {
            const name = toolbarGemEl.dataset.gemName;
            const gemDef = this.ui.getGemDefinition(name);
            if (gemDef) {
                const pattern = gemDef.gridPattern;
                potentialDragItem = {
                    name,
                    from: 'toolbar',
                    gridPattern: pattern,
                    element: toolbarGemEl,
                    offsetX: pattern[0].length / 2,
                    offsetY: pattern.length / 2,
                };
            }
        } else if (isOverCanvas && gameState.interactionMode === InteractionMode.WAVE && this.renderer && !this.game.isExtreme()) {
            const canvasRect = this.gemCanvas.getBoundingClientRect();
            const x = clientX - canvasRect.left;
            const y = clientY - canvasRect.top;
            const gem = this.getGemAtCanvasPos(x, y);
            if (gem) {
                const gridCoords = this.renderer._canvasToGridCoords(x, y);
                potentialDragItem = {
                    id: gem.id,
                    name: gem.name,
                    from: 'board',
                    gridPattern: gem.gridPattern,
                    offsetX: gridCoords.x - gem.x,
                    offsetY: gridCoords.y - gem.y,
                };

                if (gem.isFlippable) {
                    this.longPressTimeout = window.setTimeout(() => {
                        this.game.flipPlayerGem(gem.id);
                        this.longPressTriggered = true;
                        this.dragStartInfo = null;
                        this.isDragging = false;
                    }, 400);
                }
            }
        }

        // Swipe-to-paint-X: when the press starts on an empty grid cell in WAVE
        // mode (no gem, no toolbar drag, no emitter) we set up paint info.
        // Actual painting waits for the drag threshold so a tap still toggles
        // a single cell via handleCanvasTap.
        if (isOverCanvas && !potentialDragItem && this.renderer &&
            gameState.interactionMode === InteractionMode.WAVE &&
            !this.game.isExtreme() && !this.game.isGameSheet()) {
            const canvasRect = this.gemCanvas.getBoundingClientRect();
            const x = clientX - canvasRect.left;
            const y = clientY - canvasRect.top;
            const onEmitter = this.renderer.emitters.find(em => em.isInside(x, y));
            const grid = this.renderer._canvasToGridCoords(x, y);
            if (!onEmitter && this.game._inBounds(grid.x, grid.y)) {
                const isBlocked = gameState.blockedCells.some(c => c.x === grid.x && c.y === grid.y);
                this.blockPaintInfo = {
                    paintMode: !isBlocked,      // first cell flips, rest follow
                    startGrid: grid,
                    visited: new Set(),
                    painted: false,
                    axis: null,                 // 'row' or 'col', locked on first move
                };
            }
        }

        if (isOverCanvas || toolbarGemEl) {
            this.dragStartInfo = { item: potentialDragItem, startX: clientX, startY: clientY };
        }
    }

    handlePointerMove(e) {
        const coords = this.getPointerCoordinates(e);
        if (!coords) return;
        const { clientX, clientY } = coords;

        if (this.dragStartInfo) {
            if ('touches' in e) e.preventDefault();

            const dx = clientX - this.dragStartInfo.startX;
            const dy = clientY - this.dragStartInfo.startY;

            if (!this.isDragging && Math.sqrt(dx * dx + dy * dy) > 10) {
                if (this.longPressTimeout) {
                    clearTimeout(this.longPressTimeout);
                    this.longPressTimeout = null;
                }

                if (this.dragStartInfo.item) {
                    this.isDragging = true;
                    this.draggedItemInfo = this.dragStartInfo.item;
                    this.gemCanvas.style.cursor = 'grabbing';
                    if (this.draggedItemInfo.element) this.draggedItemInfo.element.classList.add('dragging');
                } else if (!this.blockPaintInfo) {
                    // No gem and no active paint stroke → fully cancel the press.
                    this.dragStartInfo = null;
                }
            }

            if (this.isDragging) {
                const canvasRect = this.gemCanvas.getBoundingClientRect();
                this.dragPos = { x: clientX - canvasRect.left, y: clientY - canvasRect.top };

                const { gridPattern, name, id, offsetX, offsetY } = this.draggedItemInfo;
                const gridCoord = this.renderer._canvasToGridCoords(this.dragPos.x, this.dragPos.y);
                const gridX = Math.round(gridCoord.x - offsetX);
                const gridY = Math.round(gridCoord.y - offsetY);

                const gemToTest = { id, name, x: gridX, y: gridY, gridPattern };
                this.lastValidDropTarget.isValid = this.game.canPlaceGem(gemToTest);
                this.lastValidDropTarget.x = gridX;
                this.lastValidDropTarget.y = gridY;

                this.ui.redrawAll();
            } else if (this.blockPaintInfo && Math.sqrt(dx * dx + dy * dy) > 10) {
                if (!this.blockPaintInfo.painted) {
                    this.blockPaintInfo.painted = true;
                    this.blockPaintInfo.axis = Math.abs(dx) >= Math.abs(dy) ? 'row' : 'col';
                    this.game.pushHistory();
                    const s = this.blockPaintInfo.startGrid;
                    this._paintBlockCell(s.x, s.y);
                    this.blockPaintInfo.lastGrid = { x: s.x, y: s.y };
                }
                const canvasRect = this.gemCanvas.getBoundingClientRect();
                const grid = this.renderer._canvasToGridCoords(
                    clientX - canvasRect.left, clientY - canvasRect.top);
                const s = this.blockPaintInfo.startGrid;
                if (this.blockPaintInfo.axis === 'row') {
                    grid.y = s.y;
                } else {
                    grid.x = s.x;
                }
                const last = this.blockPaintInfo.lastGrid;
                for (const [x, y] of this._lineCells(last.x, last.y, grid.x, grid.y)) {
                    if (this.game._inBounds(x, y)) this._paintBlockCell(x, y);
                }
                this.blockPaintInfo.lastGrid = { x: grid.x, y: grid.y };
            }
        } else {
            const isOverCanvas = e.target.closest && e.target.closest('#gem-canvas');
            if (isOverCanvas) {
                this.handleCanvasHover(clientX, clientY);
            } else {
                this.handleCanvasMouseLeave();
            }
        }
    }

    handlePointerUp(e) {
        if (this.longPressTimeout) clearTimeout(this.longPressTimeout);
        // End any in-progress swipe-to-paint stroke. If we actually painted,
        // skip the tap fallback so the start cell doesn't get re-toggled.
        const wasPainting = this.blockPaintInfo && this.blockPaintInfo.painted;
        this.blockPaintInfo = null;
        if (this.longPressTriggered) {
            this.longPressTriggered = false;
            this.dragStartInfo = null;
            this.isDragging = false;
            this.ui.redrawAll();
            return;
        }

        const coords = this.getPointerCoordinates(e);
        if (!coords || !this.renderer) {
            this.dragStartInfo = null;
            this.isDragging = false;
            return;
        }

        // No pointerdown was tracked for this gesture (e.g. click on a non-toolbar
        // button like the Game Sheet "+" tile) — let the native click event fire
        // by not rebuilding the toolbar DOM here.
        if (!this.isDragging && !this.dragStartInfo) return;

        if (this.isDragging && this.draggedItemInfo) {
            const canvasRect = this.gemCanvas.getBoundingClientRect();
            const isOverCanvas = coords.clientX >= canvasRect.left && coords.clientX <= canvasRect.right && coords.clientY >= canvasRect.top && coords.clientY <= canvasRect.bottom;

            if (isOverCanvas) {
                const { x, y } = this.lastValidDropTarget;
                if (this.draggedItemInfo.from === 'toolbar') this.game.addPlayerGem(this.draggedItemInfo.name, x, y);
                else if (this.draggedItemInfo.id) this.game.movePlayerGem(this.draggedItemInfo.id, x, y);
            } else if (this.draggedItemInfo.from === 'board' && this.draggedItemInfo.id) {
                this.game.removePlayerGem(this.draggedItemInfo.id);
            }
        } else if (this.dragStartInfo && !wasPainting) {
            const target = e.target;
            if (target.closest && target.closest('#gem-canvas')) {
                this.handleCanvasTap(coords.clientX, coords.clientY);
            }
        }

        if (this.draggedItemInfo && this.draggedItemInfo.element) this.draggedItemInfo.element.classList.remove('dragging');
        this.dragStartInfo = null;
        this.isDragging = false;
        this.draggedItemInfo = null;
        this.gemCanvas.style.cursor = 'default';
        this.ui.redrawAll();
        this.ui.updateToolbar();
    }

    handleCanvasTap(clientX, clientY) {
        if (!this.renderer) return;
        const rect = this.gemCanvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        if (gameState.interactionMode === InteractionMode.WAVE) {
            const clickedEmitter = this.renderer.emitters.find(em => em.isInside(x, y));
            if (clickedEmitter) {
                if (!clickedEmitter.isUsed) {
                    this.game.sendWave(clickedEmitter.id);
                } else {
                    const logEntry = gameState.log.find(l => l.type === InteractionMode.WAVE && (l.id === clickedEmitter.id || l.result.exitId === clickedEmitter.id));
                    if (logEntry) {
                        this.game.setSelectedLogEntry(
                            (gameState.selectedLogEntryId === logEntry.id && gameState.previewSourceEmitterId === clickedEmitter.id) ? null : logEntry.id,
                            clickedEmitter.id,
                        );
                    } else this.game.setSelectedLogEntry(null);
                }
            } else if (this.game.isGameSheet()) {
                this.game.setSelectedLogEntry(null);
            } else if (this.game.isExtreme()) {
                // Extreme: cell taps paint with the selected color.
                const gridCoords = this.renderer._canvasToGridCoords(x, y);
                if (this.game._inBounds(gridCoords.x, gridCoords.y)) {
                    this.game.paintCell(gridCoords.x, gridCoords.y);
                }
                this.game.setSelectedLogEntry(null);
            } else {
                const clickedGem = this.getGemAtCanvasPos(x, y);
                if (clickedGem && this.dragStartInfo && this.dragStartInfo.item && this.dragStartInfo.item.id === clickedGem.id) {
                    this.game.setSelectedLogEntry(null);
                    this.game.rotatePlayerGem(clickedGem.id);
                } else {
                    const gridCoords = this.renderer._canvasToGridCoords(x, y);
                    if (this.game._inBounds(gridCoords.x, gridCoords.y)) {
                        this.game.toggleBlockedCell(gridCoords.x, gridCoords.y);
                    }
                    this.game.setSelectedLogEntry(null);
                }
            }
        } else {
            const gridCoords = this.renderer._canvasToGridCoords(x, y);
            if (this.game._inBounds(gridCoords.x, gridCoords.y)) {
                this.game.queryCell(gridCoords.x, gridCoords.y);
            } else {
                this.game.setSelectedLogEntry(null);
            }
        }
    }

    handleCanvasKeyDown(e) {
        if (gameState.interactionMode !== InteractionMode.WAVE || !this.renderer) return;
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(e.key)) return;
        e.preventDefault();

        const emitters = this.renderer.emitters;
        if (e.key === 'Enter' || e.key === ' ') {
            if (this.focusedEmitterId) {
                const focusedEmitter = emitters.find(em => em.id === this.focusedEmitterId);
                if (focusedEmitter && !focusedEmitter.isUsed) this.game.sendWave(this.focusedEmitterId);
                else if (focusedEmitter && focusedEmitter.isUsed) {
                    const logEntry = gameState.log.find(l => l.type === InteractionMode.WAVE && (l.id === focusedEmitter.id || l.result.exitId === focusedEmitter.id));
                    if (logEntry) this.game.setSelectedLogEntry(
                        (gameState.selectedLogEntryId === logEntry.id && gameState.previewSourceEmitterId === focusedEmitter.id) ? null : logEntry.id,
                        focusedEmitter.id,
                    );
                }
            }
            this.ui.redrawAll();
            this.ui.updateLogHighlight();
            return;
        }

        if (!this.focusedEmitterId && emitters.length > 0) {
            this.focusedEmitterId = emitters[0].id;
        }

        const focusedIndex = emitters.findIndex(em => em.id === this.focusedEmitterId);
        if (focusedIndex === -1) return;
        let nextIndex = -1;
        switch (e.key) {
            case 'ArrowRight': nextIndex = (focusedIndex + 1) % emitters.length; break;
            case 'ArrowLeft': nextIndex = (focusedIndex - 1 + emitters.length) % emitters.length; break;
            case 'ArrowUp': nextIndex = (focusedIndex - 1 + emitters.length) % emitters.length; break;
            case 'ArrowDown': nextIndex = (focusedIndex + 1) % emitters.length; break;
        }
        if (nextIndex !== -1) {
            this.focusedEmitterId = emitters[nextIndex].id;
            this.ui.redrawAll();
        }
    }

    getGemAtCanvasPos(canvasX, canvasY) {
        if (!this.renderer || canvasX < 0 || canvasY < 0) return null;
        const { x, y } = this.renderer._canvasToGridCoords(canvasX, canvasY);
        for (let i = gameState.playerGems.length - 1; i >= 0; i--) {
            const gem = gameState.playerGems[i];
            const pHeight = gem.gridPattern.length;
            const pWidth = gem.gridPattern[0].length;
            if (x >= gem.x && x < gem.x + pWidth && y >= gem.y && y < gem.y + pHeight) {
                if (gem.gridPattern[y - gem.y][x - gem.x] !== CellState.EMPTY) {
                    return gem;
                }
            }
        }
        return null;
    }

    // Bresenham line — yields every integer grid cell along (x0,y0) → (x1,y1)
    // INCLUDING the endpoint so fast pointer moves don't skip cells.
    * _lineCells(x0, y0, x1, y1) {
        const dx = Math.abs(x1 - x0);
        const dy = -Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        let x = x0, y = y0;
        while (true) {
            yield [x, y];
            if (x === x1 && y === y1) return;
            const e2 = 2 * err;
            if (e2 >= dy) { err += dy; x += sx; }
            if (e2 <= dx) { err += dx; y += sy; }
        }
    }

    // Paint one cell during a swipe-to-paint-X stroke. No-op if the cell was
    // already visited in this stroke or already at the target paintMode.
    _paintBlockCell(x, y) {
        const key = `${y},${x}`;
        if (this.blockPaintInfo.visited.has(key)) return;
        this.blockPaintInfo.visited.add(key);
        const isBlocked = gameState.blockedCells.some(c => c.x === x && c.y === y);
        if (isBlocked !== this.blockPaintInfo.paintMode) {
            this.game.toggleBlockedCell(x, y, { skipHistory: true });
        }
    }

    getPlayerGemMap() {
        const map = new Map();
        for (const gem of gameState.playerGems) {
            for (let r = 0; r < gem.gridPattern.length; r++) {
                for (let c = 0; c < gem.gridPattern[r].length; c++) {
                    if (gem.gridPattern[r][c] !== CellState.EMPTY) {
                        map.set(`${gem.y + r},${gem.x + c}`, gem);
                    }
                }
            }
        }
        return map;
    }
}
