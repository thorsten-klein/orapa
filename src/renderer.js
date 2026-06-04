'use strict';

class Renderer {
    constructor(game, ui) {
        this.game = game;
        this.ui = ui;
        this.inputHandler = null;

        this.cellWidth = 0;
        this.cellHeight = 0;
        this.gap = 1;
        this.outerPadding = 0;
        this.emitters = [];

        this.boardWrapper = document.getElementById('game-board-wrapper');
        this.gemCanvas = document.getElementById('gem-canvas');
        this.gemCtx = this.gemCanvas.getContext('2d');
        this.pathOverlay = document.getElementById('path-overlay');
        this.pathCtx = this.pathOverlay.getContext('2d');
        this.endSolutionCanvas = document.getElementById('end-solution-canvas');
        this.endSolutionCtx = this.endSolutionCanvas.getContext('2d');

        // Re-fit on window resize / orientation change / mobile URL-bar collapse.
        window.addEventListener('resize', () => this.handleResize());
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => this.handleResize());
            window.visualViewport.addEventListener('scroll', () => this.handleResize());
        }
        const ro = new ResizeObserver(() => this.handleResize());
        ro.observe(document.documentElement);
    }

    connectInputHandler(handler) {
        this.inputHandler = handler;
    }

    handleResize() {
        // Size the board to claim as much viewport space as possible while
        // keeping the +2-cells-per-axis aspect ratio (page may scroll vertically
        // if the action panel doesn't also fit — that's intentional).
        const topbarH = document.getElementById('topbar').getBoundingClientRect().height;
        const actionBtns = document.getElementById('action-buttons');
        const actionH = actionBtns.hidden ? 0 : actionBtns.getBoundingClientRect().height;
        // Reserve room for the mode-switch wrapper only — everything below it
        // (gem toolbar, reflection toggle, …) is allowed to flow off-screen.
        const modeSwitch = document.querySelector('#screen-game .mode-switch-wrapper');
        const modeH = modeSwitch.getBoundingClientRect().height;
        const vv = window.visualViewport;
        const winW = vv ? vv.width : window.innerWidth;
        const winH = vv ? vv.height : window.innerHeight;
        const vpW = Math.max(160, winW);
        const vpH = Math.max(160, winH - topbarH - actionH - modeH);

        const aspect = (gameState.gridWidth + 2) / (gameState.gridHeight + 2);
        let bw, bh;
        if (vpW / vpH > aspect) {
            bh = vpH;
            bw = bh * aspect;
        } else {
            bw = vpW;
            bh = bw / aspect;
        }
        this.boardWrapper.style.width = bw + 'px';
        this.boardWrapper.style.height = bh + 'px';

        const wrapperRect = { width: bw, height: bh };

        const totalGridCols = gameState.gridWidth + 2;
        const totalGridRows = gameState.gridHeight + 2;

        // Reserve outer padding so emitter arrows can render outside the field.
        this.outerPadding = Math.max(10, Math.min(wrapperRect.width, wrapperRect.height) * 0.06);

        const availW = wrapperRect.width - 2 * this.outerPadding;
        const availH = wrapperRect.height - 2 * this.outerPadding;
        this.cellWidth = (availW - (totalGridCols - 1) * this.gap) / totalGridCols;
        this.cellHeight = (availH - (totalGridRows - 1) * this.gap) / totalGridRows;

        const dpr = window.devicePixelRatio;
        [this.pathOverlay, this.gemCanvas].forEach(canvas => {
            canvas.width = wrapperRect.width * dpr;
            canvas.height = wrapperRect.height * dpr;
            canvas.style.width = `${wrapperRect.width}px`;
            canvas.style.height = `${wrapperRect.height}px`;
            canvas.getContext('2d').scale(dpr, dpr);
        });

        this.emitters.forEach(emitter => emitter.updateRect(this.cellWidth, this.cellHeight, this.gap, gameState.gridWidth, gameState.gridHeight, this.outerPadding));

        this.redrawAll();
    }

    setupEmitters() {
        this.emitters = [];
        for (let i = 0; i < gameState.gridWidth; i++) {
            const tId = `T${i + 1}`;
            const bId = `B${i + 1}`;
            this.emitters.push(new EmitterButton(tId, emitterDisplayLabel(tId)));
            this.emitters.push(new EmitterButton(bId, emitterDisplayLabel(bId)));
        }
        for (let i = 0; i < gameState.gridHeight; i++) {
            const lId = `L${i + 1}`;
            const rId = `R${i + 1}`;
            this.emitters.push(new EmitterButton(lId, emitterDisplayLabel(lId)));
            this.emitters.push(new EmitterButton(rId, emitterDisplayLabel(rId)));
        }
    }

    updateEmitterFromLog(logEntry) {
        const resultColor = this.getPathColor(logEntry.result);
        const startEmitter = this.emitters.find(e => e.id === logEntry.id);
        if (startEmitter) {
            startEmitter.isUsed = true;
            startEmitter.usedColor = resultColor;
        }
        if (logEntry.result.exitId && logEntry.result.exitId !== 'Loop?') {
            const endEmitter = this.emitters.find(e => e.id === logEntry.result.exitId);
            if (endEmitter) {
                endEmitter.isUsed = true;
                endEmitter.usedColor = resultColor;
            }
        }
    }

    redrawAll() {
        if (this.gemCanvas.width === 0 || !this.inputHandler) return;

        this._clearCanvas(this.gemCtx);
        this.clearPath();

        this._drawBoardBackgroundAndGrid(this.gemCtx);
        this._drawPermanentQueryFills(this.gemCtx);
        this._drawBlockedCells(this.gemCtx);
        if (gameState.debugMode) this.drawDebugSolution(this.gemCtx);
        this.drawPlayerGems(this.gemCtx);
        this._drawPermanentQueryConflictBorders(this.gemCtx);
        if (this.inputHandler.isDragging && this.inputHandler.draggedItemInfo) {
            this.drawDragPreview(this.gemCtx);
        }
        this.drawEmitters(this.gemCtx);

        this._drawPaths(this.pathCtx);
        this._drawHoverEffects(this.pathCtx);
        this._drawTooltips(this.pathCtx);
    }

    drawEmitters(ctx) {
        const selectedLog = gameState.selectedLogEntryId ? gameState.log.find(l => l.id === gameState.selectedLogEntryId) : null;
        this.emitters.forEach(e => {
            let isSelected = false;
            if (selectedLog && selectedLog.type === InteractionMode.WAVE) {
                isSelected = (e.id === selectedLog.id || e.id === selectedLog.result.exitId);
            }
            e.state = (this.inputHandler && e.id === this.inputHandler.focusedEmitterId) ? 'focused' : 'normal';
            e.draw(ctx, isSelected);
        });
    }

    _drawPaths(ctx) {
        const selectedLog = gameState.selectedLogEntryId ? gameState.log.find(l => l.id === gameState.selectedLogEntryId) : null;
        if (selectedLog && selectedLog.type === InteractionMode.WAVE) {
            if ((gameState.showReflectionPath || gameState.debugMode) && selectedLog.path) {
                const color = this.getPathColor(selectedLog.result);
                this.drawPath(ctx, selectedLog.path, color, false);
            }
            this._drawSelectedEmitterArrows(ctx, selectedLog);
        }

        // "Show current light path": preview how the selected ray would travel
        // through the gems the player has placed so far.
        if (gameState.showPlayerPathPreview && gameState.activePlayerPath && gameState.activePlayerResult) {
            const playerColor = this.getPathColor(gameState.activePlayerResult);
            this.drawPath(ctx, gameState.activePlayerPath, playerColor, true);
        }
    }

    _drawSelectedEmitterArrows(ctx, selectedLog) {
        // The selected emitter is always treated as the input side. When the
        // wave's original exit was clicked, we flip in/out so the arrow at the
        // clicked emitter still reads as "in".
        const inId = gameState.previewSourceEmitterId || selectedLog.id;
        const outId = (inId === selectedLog.id) ? selectedLog.result.exitId : selectedLog.id;

        const inEmitter  = this.emitters.find(e => e.id === inId);
        const outEmitter = this.emitters.find(e => e.id === outId);
        const color = this.getPathColor(selectedLog.result);

        if (inEmitter && outEmitter && inEmitter === outEmitter) {
            // Entry == exit on same field: render them side-by-side along the edge.
            this._drawEmitterArrow(ctx, inEmitter, 'in', color, -1);
            this._drawEmitterArrow(ctx, outEmitter, 'out', color, +1);
        } else {
            if (inEmitter)  this._drawEmitterArrow(ctx, inEmitter, 'in', color, 0);
            if (outEmitter) this._drawEmitterArrow(ctx, outEmitter, 'out', color, 0);
        }
    }

    // Draw an arrowhead outside the field, adjacent to the emitter.
    // 'in'  → arrow points TOWARD the emitter (light entering board through it)
    // 'out' → arrow points AWAY from the emitter (light exiting board)
    // lateralOffset: -1 / 0 / +1 — perpendicular shift along the board edge,
    // used when both arrows share the same emitter.
    _drawEmitterArrow(ctx, emitter, kind, color, lateralOffset) {
        if (lateralOffset === undefined) lateralOffset = 0;
        const side = emitter.id[0]; // T/B/L/R
        const r = emitter.rect;
        const cx = r.x + r.width / 2;
        const cy = r.y + r.height / 2;
        const size = Math.min(r.width, r.height) * 0.5;
        // Direction from board to outside (away from the field)
        let outDx = 0, outDy = 0;
        switch (side) {
            case 'T': outDy = -1; break;
            case 'B': outDy =  1; break;
            case 'L': outDx = -1; break;
            case 'R': outDx =  1; break;
        }
        // Anchor: out in the padding zone past the emitter, shifted laterally
        // along the board edge so two arrows on the same emitter don't overlap.
        const anchorOffset = Math.min(r.width, r.height) * 0.95;
        const lateralStep = Math.min(r.width, r.height) * 0.35;
        const perpX = -outDy, perpY = outDx;
        const ax = cx + outDx * anchorOffset + perpX * lateralOffset * lateralStep;
        const ay = cy + outDy * anchorOffset + perpY * lateralOffset * lateralStep;
        // Tip direction: 'in' points back toward emitter, 'out' points further outward
        const dx = kind === 'in' ? -outDx : outDx;
        const dy = kind === 'in' ? -outDy : outDy;

        const half = size / 2;
        const tipX = ax + dx * half;
        const tipY = ay + dy * half;
        const baseX = ax - dx * half;
        const baseY = ay - dy * half;
        const px = -dy, py = dx;
        const halfW = size * 0.55;

        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 3;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(baseX + px * halfW, baseY + py * halfW);
        ctx.lineTo(baseX - px * halfW, baseY - py * halfW);
        ctx.closePath();
        // Input arrow: "No color" (light hasn't been tinted yet). Output: result color.
        ctx.fillStyle = kind === 'in' ? 'rgba(236, 240, 241, 0.7)' : color;
        ctx.strokeStyle = 'rgba(0,0,0,0.65)';
        ctx.lineWidth = 1;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    _drawHoverEffects(ctx) {
        if (this.inputHandler && this.inputHandler.hoveredGridCell && gameState.interactionMode === InteractionMode.QUERY && !this.inputHandler.isDragging) {
            this._drawQueryHover(ctx);
        }
    }

    _drawTooltips(ctx) {
        const selectedLog = gameState.selectedLogEntryId ? gameState.log.find(l => l.id === gameState.selectedLogEntryId) : null;
        if (selectedLog && selectedLog.type === InteractionMode.WAVE) {
            this._drawSelectedWaveTooltip(ctx);
        }
    }

    _drawBoardBackgroundAndGrid(ctx) {
        ctx.save();

        const vCols = gameState.gridWidth;
        const vRows = gameState.gridHeight;

        const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border-color');

        ctx.translate(this.outerPadding, this.outerPadding);

        // Just the inner-grid frame; canvas itself stays transparent.
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = this.gap;
        ctx.strokeRect(
            this.cellWidth + this.gap,
            this.cellHeight + this.gap,
            vCols * (this.cellWidth + this.gap) - this.gap,
            vRows * (this.cellHeight + this.gap) - this.gap,
        );

        ctx.strokeStyle = borderColor;
        ctx.lineWidth = this.gap;
        ctx.beginPath();
        for (let i = 1; i < vCols; i++) {
            const x = (i + 1) * (this.cellWidth + this.gap) - this.gap / 2;
            ctx.moveTo(x, this.cellHeight + this.gap);
            ctx.lineTo(x, (vRows + 1) * (this.cellHeight + this.gap));
        }
        for (let i = 1; i < vRows; i++) {
            const y = (i + 1) * (this.cellHeight + this.gap) - this.gap / 2;
            ctx.moveTo(this.cellWidth + this.gap, y);
            ctx.lineTo((vCols + 1) * (this.cellWidth + this.gap), y);
        }
        ctx.stroke();

        ctx.restore();
    }

    _drawBlockedCells(ctx) {
        if (gameState.blockedCells.length === 0) return;

        ctx.save();
        for (const cell of gameState.blockedCells) {
            const coords = this._gridToCanvasCoords(cell.x, cell.y);
            const w = this.cellWidth;
            const h = this.cellHeight;
            const padding = Math.min(w, h) * 0.2;

            ctx.fillStyle = 'rgba(231, 76, 60, 0.12)';
            ctx.fillRect(coords.x, coords.y, w, h);

            ctx.strokeStyle = 'rgba(231, 76, 60, 0.7)';
            ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.08);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(coords.x + padding, coords.y + padding);
            ctx.lineTo(coords.x + w - padding, coords.y + h - padding);
            ctx.moveTo(coords.x + w - padding, coords.y + padding);
            ctx.lineTo(coords.x + padding, coords.y + h - padding);
            ctx.stroke();
        }
        ctx.restore();
    }

    _drawPermanentQueryFills(ctx) {
        if (gameState.permanentQueryResults.length === 0) return;

        const playerGemMap = this.inputHandler.getPlayerGemMap();

        ctx.save();
        ctx.globalAlpha = 0.5;

        for (const query of gameState.permanentQueryResults) {
            const { coords, result } = query;
            const playerGemOnCell = playerGemMap.get(`${coords.y},${coords.x}`);

            if (!playerGemOnCell) {
                const canvasCoords = this._gridToCanvasCoords(coords.x, coords.y);
                if (result.colorHex) {
                    ctx.fillStyle = this.isTransparentColor(result.colorHex)
                        ? transparentFillRgba(0.5)
                        : result.colorHex;
                } else {
                    ctx.fillStyle = 'rgba(127, 140, 141, 0.35)';
                }
                ctx.fillRect(canvasCoords.x, canvasCoords.y, this.cellWidth, this.cellHeight);
            }
        }
        ctx.restore();
    }

    _drawPermanentQueryConflictBorders(ctx) {
        if (gameState.permanentQueryResults.length === 0) return;

        const playerGemMap = this.inputHandler.getPlayerGemMap();

        ctx.save();
        for (const query of gameState.permanentQueryResults) {
            const { coords, result: correctResult } = query;
            const playerGemOnCell = playerGemMap.get(`${coords.y},${coords.x}`);

            if (playerGemOnCell) {
                const playerGemResult = this.game.getQueryResult(playerGemOnCell);
                if (playerGemResult.colorName !== correctResult.colorName) {
                    const canvasCoords = this._gridToCanvasCoords(coords.x, coords.y);
                    ctx.strokeStyle = correctResult.colorHex || 'white';
                    ctx.lineWidth = 3;
                    ctx.globalAlpha = 1;
                    ctx.shadowColor = 'black';
                    ctx.shadowBlur = 6;
                    ctx.strokeRect(canvasCoords.x + 1.5, canvasCoords.y + 1.5, this.cellWidth - 3, this.cellHeight - 3);
                }
            }
        }
        ctx.restore();
    }

    drawPlayerGems(ctx) {
        for (const gem of gameState.playerGems) {
            if (this.inputHandler && this.inputHandler.isDragging && this.inputHandler.draggedItemInfo && this.inputHandler.draggedItemInfo.from === 'board' && this.inputHandler.draggedItemInfo.id === gem.id) continue;

            const gemDef = this.game.getGemDefinition(gem.name);
            if (!gemDef) continue;

            let isHovered = false;
            if (this.inputHandler && !this.inputHandler.isDragging && gameState.interactionMode === InteractionMode.WAVE) {
                const hovered = this.inputHandler.getGemAtCanvasPos(this.inputHandler.dragPos.x, this.inputHandler.dragPos.y);
                isHovered = hovered ? hovered.id === gem.id : false;
            }

            this.drawGem(ctx, gem, gemDef.color, !gem.isValid, isHovered);
        }
    }

    drawDebugSolution(ctx) {
        if (!this.game.secretGrid || gameState.secretGems.length === 0) return;
        ctx.save();
        ctx.globalAlpha = 0.2;
        for (const gem of gameState.secretGems) {
            const gemDef = this.game.getGemDefinition(gem.name);
            if (gemDef) this.drawGem(ctx, gem, gemDef.color);
        }
        ctx.restore();
    }

    drawDragPreview(ctx) {
        if (!this.inputHandler || !this.inputHandler.draggedItemInfo) return;
        const { gridPattern, name } = this.inputHandler.draggedItemInfo;
        const gemDef = this.game.getGemDefinition(name);
        if (!gemDef) return;

        const { x, y, isValid } = this.inputHandler.lastValidDropTarget;

        ctx.save();
        ctx.globalAlpha = 0.7;
        this.drawGem(ctx, { x, y, gridPattern }, gemDef.color, !isValid);
        ctx.restore();
    }

    drawGem(ctx, gem, color, isInvalid, isHovered) {
        if (isInvalid === undefined) isInvalid = false;
        if (isHovered === undefined) isHovered = false;
        const { gridPattern, x, y } = gem;
        for (let r = 0; r < gridPattern.length; r++) {
            for (let c = 0; c < gridPattern[r].length; c++) {
                if (gridPattern[r][c] !== CellState.EMPTY) {
                    const canvasCoords = this._gridToCanvasCoords(x + c, y + r);
                    this.drawCellShape(ctx, canvasCoords.x, canvasCoords.y, this.cellWidth, this.cellHeight, gridPattern[r][c], color, isInvalid, isHovered);
                }
            }
        }
    }

    drawCellShape(ctx, x, y, w, h, state, color, isInvalid, isHovered) {
        if (isInvalid === undefined) isInvalid = false;
        if (isHovered === undefined) isHovered = false;
        ctx.save();

        if (this.isTransparentColor(color)) {
            ctx.fillStyle = transparentFillRgba(0.3);
            ctx.strokeStyle = '#a4d4e4';
            ctx.lineWidth = 2;
        } else if (color === COLORS.BLACK_GEM) {
            ctx.fillStyle = color;
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 1;
        } else {
            ctx.fillStyle = color;
            ctx.strokeStyle = 'rgba(0,0,0,0.4)';
            ctx.lineWidth = 1;
        }

        if (isHovered && !isInvalid) {
            ctx.shadowColor = 'white';
            ctx.shadowBlur = 10;
        }
        if (isInvalid) {
            ctx.fillStyle = 'rgba(231, 76, 60, 0.5)';
            ctx.strokeStyle = COLORS.INVALID_GEM;
            ctx.lineWidth = 2;
            if (isHovered) {
                ctx.shadowColor = 'white';
                ctx.shadowBlur = 10;
            }
        }

        ctx.beginPath();
        const path = new Path2D();
        switch (state) {
            case CellState.BLOCK:
            case CellState.ABSORB:
                path.rect(x, y, w, h); break;
            case CellState.TRIANGLE_TL:
                path.moveTo(x, y); path.lineTo(x + w, y); path.lineTo(x, y + h); path.closePath(); break;
            case CellState.TRIANGLE_TR:
                path.moveTo(x, y); path.lineTo(x + w, y); path.lineTo(x + w, y + h); path.closePath(); break;
            case CellState.TRIANGLE_BR:
                path.moveTo(x + w, y); path.lineTo(x + w, y + h); path.lineTo(x, y + h); path.closePath(); break;
            case CellState.TRIANGLE_BL:
                path.moveTo(x, y); path.lineTo(x, y + h); path.lineTo(x + w, y + h); path.closePath(); break;
        }
        ctx.fill(path);
        ctx.stroke(path);
        ctx.restore();
    }

    drawPath(ctx, path, color, isPreview) {
        if (isPreview === undefined) isPreview = false;
        if (path.length < 2) return;

        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 5;

        if (isPreview) {
            ctx.globalAlpha = 0.6;
            ctx.setLineDash([8, 6]);
        }

        ctx.beginPath();
        const gridStartX = this.outerPadding + this.cellWidth + this.gap;
        const gridStartY = this.outerPadding + this.cellHeight + this.gap;
        const stepX = this.cellWidth + this.gap;
        const stepY = this.cellHeight + this.gap;

        const p2c = (p) => ({ x: gridStartX + p.x * stepX, y: gridStartY + p.y * stepY });

        ctx.moveTo(p2c(path[0]).x, p2c(path[0]).y);
        for (let i = 1; i < path.length; i++) {
            ctx.lineTo(p2c(path[i]).x, p2c(path[i]).y);
        }
        ctx.stroke();
        ctx.restore();
    }

    _clearCanvas(ctx) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.restore();
    }

    clearPath() {
        this._clearCanvas(this.pathCtx);
    }

    getPathColor(result) {
        if (result.absorbed) return COLORS.ABSORBED;
        if (result.colors.length === 0) return 'rgba(236, 240, 241, 0.7)';
        return COLOR_MIXING[colorComboKey(result.colors)] || '#ccc';
    }

    _gridToCanvasCoords(gridX, gridY) {
        return {
            x: this.outerPadding + (gridX + 1) * (this.cellWidth + this.gap),
            y: this.outerPadding + (gridY + 1) * (this.cellHeight + this.gap),
        };
    }

    _canvasToGridCoords(canvasX, canvasY) {
        return {
            x: Math.floor((canvasX - this.outerPadding) / (this.cellWidth + this.gap)) - 1,
            y: Math.floor((canvasY - this.outerPadding) / (this.cellHeight + this.gap)) - 1,
        };
    }

    drawToolbarGem(canvas, gemDef) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, rect.width, rect.height);

        const pattern = gemDef.gridPattern;
        const pHeight = pattern.length;
        const pWidth = pattern[0].length;
        // Shrink absorber (black) tiles so they don't dominate the toolbar slot.
        const isAbsorber = gemDef.special === 'absorbs';
        const scaleFactor = isAbsorber ? 0.8 : 1.0;
        const cellSize = Math.min(rect.width / pWidth, rect.height / pHeight) * scaleFactor;
        const renderedWidth = pWidth * cellSize;
        const renderedHeight = pHeight * cellSize;
        const offsetX = (rect.width - renderedWidth) / 2;
        const offsetY = (rect.height - renderedHeight) / 2;
        const color = gemDef.color || '#bdc3c7';

        for (let r = 0; r < pHeight; r++) {
            for (let c = 0; c < pWidth; c++) {
                if (pattern[r][c] !== CellState.EMPTY) {
                    this.drawCellShape(ctx, c * cellSize + offsetX, r * cellSize + offsetY, cellSize, cellSize, pattern[r][c], color);
                }
            }
        }
    }

    // Render a single solution (just one gem set, full opacity) onto an
    // arbitrary canvas — used for the download buttons. Adds a solid
    // background so JPG export looks right.
    drawSolutionTo(canvas, gems) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = this.gemCanvas.width;
        canvas.height = this.gemCanvas.height;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        // Opaque background (JPG has no alpha channel)
        const bg = getComputedStyle(document.documentElement).getPropertyValue('--surface-elevated').trim() || '#36202b';
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(dpr, dpr);

        this._drawBoardBackgroundAndGrid(ctx);
        this.emitters.forEach(e => e.draw(ctx, false));
        for (const gem of gems) {
            const gemDef = this.game.getGemDefinition(gem.name);
            if (gemDef) this.drawGem(ctx, gem, gemDef.color, false);
        }
    }

    drawEndScreenSolution(correctGems, playerGems) {
        const solutionCanvas = this.endSolutionCanvas;
        const solutionCtx = this.endSolutionCtx;
        const dpr = window.devicePixelRatio || 1;

        solutionCanvas.width = this.gemCanvas.width;
        solutionCanvas.height = this.gemCanvas.height;
        const naturalW = parseFloat(this.gemCanvas.style.width) || (this.gemCanvas.width / dpr);
        const naturalH = parseFloat(this.gemCanvas.style.height) || (this.gemCanvas.height / dpr);
        const wrapper = solutionCanvas.parentElement;
        const availW = wrapper ? wrapper.clientWidth : naturalW;
        const scale = (availW > 0 && naturalW > 0) ? Math.min(1, availW / naturalW) : 1;
        solutionCanvas.style.width = (naturalW * scale) + 'px';
        solutionCanvas.style.height = (naturalH * scale) + 'px';

        solutionCtx.setTransform(1, 0, 0, 1, 0, 0);
        solutionCtx.clearRect(0, 0, solutionCanvas.width, solutionCanvas.height);

        solutionCtx.scale(dpr, dpr);

        const drawGems = (ctx, gems, opacity, highlightInvalid) => {
            ctx.save();
            ctx.globalAlpha = opacity;
            for (const gem of gems) {
                const gemDef = this.game.getGemDefinition(gem.name);
                if (gemDef) this.drawGem(ctx, gem, gemDef.color, highlightInvalid ? !gem.isValid : false);
            }
            ctx.restore();
        };

        this._drawBoardBackgroundAndGrid(solutionCtx);
        this.emitters.forEach(e => e.draw(solutionCtx, false));
        drawGems(solutionCtx, correctGems, 1.0, false);
        if (playerGems.length > 0) {
            drawGems(solutionCtx, playerGems, 0.55, true);
        }
    }

    _drawSelectedWaveTooltip(ctx) {
        if (!this.inputHandler) return;
        const selectedLog = gameState.log.find(l => l.id === gameState.selectedLogEntryId);
        if (!selectedLog || selectedLog.type !== InteractionMode.WAVE) return;

        const contextEmitterId = gameState.previewSourceEmitterId || selectedLog.id;
        const contextEmitter = this.emitters.find(e => e.id === contextEmitterId);
        if (!contextEmitter) return;

        const pathColorName = this.ui.getPathColorName(selectedLog.result);
        const startLbl = emitterDisplayLabel(selectedLog.id);
        const exitLbl  = emitterDisplayLabel(selectedLog.result.exitId);
        const text = (contextEmitterId === selectedLog.id)
            ? `${startLbl} ➔ ${pathColorName} ➔ ${exitLbl}`
            : `${exitLbl} ➔ ${pathColorName} ➔ ${startLbl}`;

        this.drawTooltip(ctx, text, contextEmitter.rect);
    }

    drawTooltip(ctx, text, anchorRect) {
        ctx.save();
        const fontSize = this.cellHeight * 0.35;
        ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`;
        ctx.textBaseline = 'middle';

        const textMetrics = ctx.measureText(text);
        const padding = { x: 8, y: 5 };
        const rectWidth = textMetrics.width + padding.x * 2;
        const rectHeight = fontSize + padding.y * 2;
        const margin = 5;
        const canvasW = this.gemCanvas.width / (window.devicePixelRatio || 1);
        const canvasH = this.gemCanvas.height / (window.devicePixelRatio || 1);

        let rectX = 0, rectY = 0;

        rectY = anchorRect.y + anchorRect.height + margin;
        rectX = anchorRect.x + anchorRect.width / 2 - rectWidth / 2;
        if (rectY + rectHeight > canvasH) {
            rectY = anchorRect.y - rectHeight - margin;
            if (rectY < 0) {
                rectX = anchorRect.x + anchorRect.width + margin;
                rectY = anchorRect.y + anchorRect.height / 2 - rectHeight / 2;
                if (rectX + rectWidth > canvasW) {
                    rectX = anchorRect.x - rectWidth - margin;
                }
            }
        }

        if (rectX < 0) rectX = 0;
        if (rectX + rectWidth > canvasW) rectX = canvasW - rectWidth;
        if (rectY < 0) rectY = 0;
        if (rectY + rectHeight > canvasH) rectY = canvasH - rectHeight;

        ctx.fillStyle = 'black';
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(rectX, rectY, rectWidth, rectHeight, 6);
        } else {
            ctx.rect(rectX, rectY, rectWidth, rectHeight);
        }
        ctx.fill();

        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText(text, rectX + rectWidth / 2, rectY + rectHeight / 2);
        ctx.restore();
    }

    _drawQueryHover(ctx) {
        if (!this.inputHandler || !this.inputHandler.hoveredGridCell) return;
        const { x, y } = this.inputHandler.hoveredGridCell;
        const canvasCoords = this._gridToCanvasCoords(x, y);

        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7;
        ctx.strokeRect(canvasCoords.x, canvasCoords.y, this.cellWidth, this.cellHeight);
        ctx.restore();
    }

    isTransparentColor(color) {
        return color === COLORS.TRANSPARENT;
    }

    getBaseColorHex(colorKey) {
        const c = BASE_COLORS[colorKey];
        return c ? c.color : '#000';
    }

}
