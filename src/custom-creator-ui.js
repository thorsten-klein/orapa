'use strict';

class CustomCreatorUI {
    constructor(game, renderer) {
        this.game = game;
        this.renderer = renderer;

        this.customColorSelector = document.getElementById('custom-color-selector');
        this.customShapeSelector = document.getElementById('custom-shape-selector');
        this.previewWrap = document.getElementById('custom-gem-preview');
        this.previewCanvas = document.getElementById('custom-gem-preview-canvas');
        this.btnAddCustomGem = document.getElementById('btn-add-custom-gem');
        this.customGemList = document.getElementById('custom-gem-list');
        this.customValidationFeedback = document.getElementById('custom-validation-feedback');
        this.btnStartCustomLevel = document.getElementById('btn-start-custom-level');

        this.designerModal = document.getElementById('custom-shape-designer-modal');
        this.designerGrid = document.getElementById('designer-grid');
        this.designerPreviewCanvas = document.getElementById('designer-preview-canvas');
        this.btnFinishDesign = document.getElementById('btn-finish-design');
        this.btnCancelDesign = document.getElementById('btn-cancel-design');

        this.state = {
            selectedColorKey: null,
            selectedShapeKey: null,
            gems: [],
            designerGridState: [],
        };

        this.customDesignedShape = null;

        this.btnAddCustomGem.addEventListener('click', () => this.handleAddCustomGem());
        this.btnStartCustomLevel.addEventListener('click', () => this.handleStartCustomLevel());
        this.btnFinishDesign.addEventListener('click', () => this.handleFinishDesign());
        this.btnCancelDesign.addEventListener('click', () => this.closeDesigner());

        // Random level modal
        this._size = { W: 8, H: 10 };
        this._sizeLimits = { W: [8, 20], H: [8, 20] };
        document.querySelectorAll('.creator-config .stepper-btn[data-size]').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.size;
                const delta = parseInt(btn.dataset.delta);
                const [lo, hi] = this._sizeLimits[key];
                this._size[key] = Math.max(lo, Math.min(hi, this._size[key] + delta));
                this._updateSizeSteppers();
            });
        });

        this.randomModal = document.getElementById('random-level-modal');
        this.btnRandomLevel = document.getElementById('btn-random-level');
        this.btnGenerateRandom = document.getElementById('btn-generate-random');
        this.btnCancelRandom = document.getElementById('btn-cancel-random');
        this._randomCounts = { WHITE: 1, TRANSPARENT: 1, BLACK: 1 };
        this._randomLimits = { WHITE: [1, 4], TRANSPARENT: [0, 4], BLACK: [0, 1] };
        this.btnRandomLevel.addEventListener('click', () => this.openRandomModal());
        this.btnGenerateRandom.addEventListener('click', () => this.generateRandomLevel());
        this.btnCancelRandom.addEventListener('click', () => this.closeRandomModal());
        this.randomModal.addEventListener('click', (e) => { if (e.target === this.randomModal) this.closeRandomModal(); });
        this.randomModal.querySelectorAll('.stepper-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.rnd;
                const delta = parseInt(btn.dataset.delta);
                const [lo, hi] = this._randomLimits[key];
                this._randomCounts[key] = Math.max(lo, Math.min(hi, this._randomCounts[key] + delta));
                this._updateRandomSteppers();
            });
        });
    }

    _updateSizeSteppers() {
        document.querySelectorAll('[data-size-val]').forEach(el => {
            el.textContent = String(this._size[el.dataset.sizeVal]);
        });
        document.querySelectorAll('.creator-config .stepper-btn[data-size]').forEach(btn => {
            const key = btn.dataset.size;
            const delta = parseInt(btn.dataset.delta);
            const [lo, hi] = this._sizeLimits[key];
            const next = this._size[key] + delta;
            btn.disabled = next < lo || next > hi;
        });
    }

    _updateRandomSteppers() {
        for (const [key, val] of Object.entries(this._randomCounts)) {
            const el = this.randomModal.querySelector(`[data-rnd-val="${key}"]`);
            if (el) el.textContent = String(val);
        }
        this.randomModal.querySelectorAll('.stepper-btn').forEach(btn => {
            const key = btn.dataset.rnd;
            const delta = parseInt(btn.dataset.delta);
            const [lo, hi] = this._randomLimits[key];
            const next = this._randomCounts[key] + delta;
            btn.disabled = next < lo || next > hi;
        });
    }

    openRandomModal() {
        this._updateRandomSteppers();
        this.randomModal.classList.remove('hidden');
    }

    closeRandomModal() {
        this.randomModal.classList.add('hidden');
    }

    generateRandomLevel() {
        // Shapes available to randomize (skip CUSTOM_DESIGN — needs hand-drawing)
        const shapeKeys = Object.keys(CUSTOM_SHAPES).filter(k => k !== 'SHAPE_CUSTOM_DESIGN' && k !== 'SHAPE_ABSORBER');
        const pickShape = () => CUSTOM_SHAPES[shapeKeys[Math.floor(Math.random() * shapeKeys.length)]];

        const newGems = [];
        const addGem = (colorKey, shapeDef) => {
            const colorDef = BASE_COLORS[colorKey];
            let pattern;
            if (colorKey === 'BLACK') {
                pattern = shapeDef.gridPattern.map(row =>
                    row.map(cell => (cell !== CellState.EMPTY ? CellState.ABSORB : CellState.EMPTY)));
            } else {
                pattern = shapeDef.gridPattern.map(row =>
                    row.map(cell => (cell === CellState.ABSORB ? CellState.BLOCK : cell)));
            }
            newGems.push(Object.assign({}, colorDef, shapeDef, {
                gridPattern: pattern,
                name: `CUSTOM_${colorKey}_${shapeDef.name}_${Date.now()}_${newGems.length}`,
                originalColorKey: colorKey,
            }));
        };

        // Always one of each RGB
        addGem('RED', pickShape());
        addGem('YELLOW', pickShape());
        addGem('BLUE', pickShape());
        for (let i = 0; i < this._randomCounts.WHITE; i++) addGem('WHITE', pickShape());
        for (let i = 0; i < this._randomCounts.TRANSPARENT; i++) addGem('TRANSPARENT', pickShape());
        for (let i = 0; i < this._randomCounts.BLACK; i++) addGem('BLACK', CUSTOM_SHAPES.SHAPE_ABSORBER);

        this.state.gems = newGems;
        this.updateCustomGemList();
        this.validateCustomSet();
        this.closeRandomModal();
    }

    setup(initialDims) {
        const hasPreviousCustomLevel = gameState.customGemSet.length > 0 && Object.keys(gameState.customGemDefinitions).length > 0;
        const initialGems = hasPreviousCustomLevel
            ? gameState.customGemSet.map(gemName => gameState.customGemDefinitions[gemName]).filter(Boolean)
            : [];

        this.state = {
            selectedColorKey: null,
            selectedShapeKey: null,
            gems: initialGems,
            designerGridState: Array.from({ length: 4 }, () => Array(4).fill(CellState.EMPTY)),
        };

        if (initialDims && initialDims.gridWidth && initialDims.gridHeight) {
            const [wLo, wHi] = this._sizeLimits.W;
            const [hLo, hHi] = this._sizeLimits.H;
            this._size.W = Math.max(wLo, Math.min(wHi, initialDims.gridWidth));
            this._size.H = Math.max(hLo, Math.min(hHi, initialDims.gridHeight));
        }

        this.populateSelectors();
        this.updateCustomGemList();
        this.validateCustomSet();
        this._updateSizeSteppers();
        this._refreshPreview();
    }

    _buildPreviewGemDef() {
        const { selectedColorKey, selectedShapeKey } = this.state;
        if (!selectedColorKey || !selectedShapeKey) return null;

        const shapeDef = (selectedShapeKey === 'SHAPE_CUSTOM_DESIGN' && this.customDesignedShape)
            ? this.customDesignedShape
            : CUSTOM_SHAPES[selectedShapeKey];
        if (!shapeDef || !shapeDef.gridPattern) return null;

        const colorDef = BASE_COLORS[selectedColorKey];
        if (!colorDef) return null;

        const pattern = selectedColorKey === 'BLACK'
            ? shapeDef.gridPattern.map(row => row.map(cell => (cell !== CellState.EMPTY ? CellState.ABSORB : CellState.EMPTY)))
            : shapeDef.gridPattern.map(row => row.map(cell => (cell === CellState.ABSORB ? CellState.BLOCK : cell)));

        return Object.assign({}, colorDef, shapeDef, { gridPattern: pattern });
    }

    _refreshPreview() {
        if (!this.previewWrap || !this.previewCanvas) return;
        const def = this._buildPreviewGemDef();
        if (!def) {
            this.previewWrap.classList.remove('has-preview');
            const ctx = this.previewCanvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
            return;
        }
        this.previewWrap.classList.add('has-preview');
        setTimeout(() => this.renderer.drawToolbarGem(this.previewCanvas, def), 0);
    }

    drawAddIcon(canvas) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx.scale(dpr, dpr);
        }

        ctx.clearRect(0, 0, rect.width, rect.height);

        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--primary-color');
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const lineLength = Math.min(rect.width, rect.height) * 0.4;

        ctx.beginPath();
        ctx.moveTo(centerX - lineLength / 2, centerY);
        ctx.lineTo(centerX + lineLength / 2, centerY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(centerX, centerY - lineLength / 2);
        ctx.lineTo(centerX, centerY + lineLength / 2);
        ctx.stroke();
    }

    populateSelectors() {
        this.customColorSelector.innerHTML = '';
        Object.entries(BASE_COLORS).forEach(([key, value]) => {
            const div = document.createElement('div');
            div.className = 'color-choice';
            div.dataset.colorKey = key;

            const swatch = document.createElement('div');
            swatch.className = 'color-choice__swatch';
            swatch.style.backgroundColor = value.color;
            if (this.renderer.isTransparentColor(value.color)) {
                swatch.style.border = `2px solid ${COLORS.TRANSPARENT}`;
                swatch.style.backgroundColor = transparentFillRgba(0.3);
            }
            div.appendChild(swatch);

            const label = document.createElement('div');
            label.className = 'color-choice__label';
            label.textContent = value.name;
            div.appendChild(label);

            div.title = value.name;
            div.onclick = () => {
                this.state.selectedColorKey = key;
                this.customColorSelector.querySelectorAll('.color-choice').forEach(el => el.classList.remove('selected'));
                div.classList.add('selected');
                this._refreshPreview();
            };
            this.customColorSelector.appendChild(div);
        });

        this.customShapeSelector.innerHTML = '';
        Object.entries(CUSTOM_SHAPES).forEach(([key, value]) => {
            const div = document.createElement('div');
            div.className = 'shape-choice';
            div.dataset.shapeKey = key;
            div.title = value.name;
            const canvas = document.createElement('canvas');
            div.appendChild(canvas);

            if (key === 'SHAPE_CUSTOM_DESIGN') {
                div.onclick = () => this.openDesigner();
                setTimeout(() => {
                    if (this.customDesignedShape) {
                        this.renderer.drawToolbarGem(canvas, Object.assign({}, this.customDesignedShape, { color: COLORS.TRANSPARENT }));
                    } else {
                        div.classList.add('shape-choice-add');
                        this.drawAddIcon(canvas);
                    }
                }, 0);
            } else {
                div.onclick = () => {
                    this.state.selectedShapeKey = key;
                    this.customShapeSelector.querySelectorAll('.shape-choice').forEach(el => el.classList.remove('selected'));
                    div.classList.add('selected');
                    this._refreshPreview();
                };
                setTimeout(() => this.renderer.drawToolbarGem(canvas, Object.assign({}, value, { color: COLORS.TRANSPARENT })), 0);
            }
            this.customShapeSelector.appendChild(div);
        });
    }

    padPattern(pattern, rows, cols) {
        const newPattern = Array.from({ length: rows }, () => Array(cols).fill(CellState.EMPTY));
        const pRows = pattern.length;
        const pCols = pattern[0].length;
        const startRow = Math.floor((rows - pRows) / 2);
        const startCol = Math.floor((cols - pCols) / 2);

        for (let r = 0; r < pRows; r++) {
            for (let c = 0; c < pCols; c++) {
                if (startRow + r < rows && startCol + c < cols) {
                    newPattern[startRow + r][startCol + c] = pattern[r][c];
                }
            }
        }
        return newPattern;
    }

    openDesigner() {
        this.designerModal.classList.remove('hidden');
        this.designerGrid.innerHTML = '';

        const patternToLoad = this.customDesignedShape
            ? this.padPattern(this.customDesignedShape.gridPattern, 4, 4)
            : Array.from({ length: 4 }, () => Array(4).fill(CellState.EMPTY));

        this.state.designerGridState = JSON.parse(JSON.stringify(patternToLoad));

        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                const cellWrapper = document.createElement('div');
                cellWrapper.className = 'designer-cell';
                cellWrapper.dataset.row = r.toString();
                cellWrapper.dataset.col = c.toString();
                const canvas = document.createElement('canvas');
                cellWrapper.appendChild(canvas);
                cellWrapper.onclick = () => this.handleDesignerCellClick(r, c);
                this.designerGrid.appendChild(cellWrapper);
            }
        }
        this.updateDesignerGridCanvases();
        this.updateDesignerPreview();
    }

    closeDesigner() {
        this.designerModal.classList.add('hidden');
    }

    handleDesignerCellClick(row, col) {
        const currentState = this.state.designerGridState[row][col];
        const nextState = (currentState + 1) % 6;
        this.state.designerGridState[row][col] = nextState;

        const cellCanvas = this.designerGrid.querySelector(`[data-row='${row}'][data-col='${col}'] canvas`);
        if (cellCanvas) {
            this.drawDesignerCell(cellCanvas, nextState);
        }
        this.updateDesignerPreview();
    }

    updateDesignerGridCanvases() {
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                const cellCanvas = this.designerGrid.querySelector(`[data-row='${r}'][data-col='${c}'] canvas`);
                if (cellCanvas) {
                    this.drawDesignerCell(cellCanvas, this.state.designerGridState[r][c]);
                }
            }
        }
    }

    drawDesignerCell(canvas, state) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const requiredBitmapWidth = Math.round(rect.width * dpr);
        const requiredBitmapHeight = Math.round(rect.height * dpr);

        if (canvas.width !== requiredBitmapWidth || canvas.height !== requiredBitmapHeight) {
            canvas.width = requiredBitmapWidth;
            canvas.height = requiredBitmapHeight;
        }

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, rect.width, rect.height);

        if (state !== CellState.EMPTY) {
            ctx.fillStyle = COLORS.TRANSPARENT;
            ctx.strokeStyle = 'rgba(0,0,0,0.4)';
            ctx.lineWidth = 1;

            ctx.beginPath();
            const path = new Path2D();
            const w = rect.width, h = rect.height, x = 0, y = 0;

            switch (state) {
                case CellState.BLOCK: path.rect(x, y, w, h); break;
                case CellState.TRIANGLE_TL: path.moveTo(x, y); path.lineTo(x + w, y); path.lineTo(x, y + h); path.closePath(); break;
                case CellState.TRIANGLE_TR: path.moveTo(x, y); path.lineTo(x + w, y); path.lineTo(x + w, y + h); path.closePath(); break;
                case CellState.TRIANGLE_BR: path.moveTo(x + w, y); path.lineTo(x + w, y + h); path.lineTo(x, y + h); path.closePath(); break;
                case CellState.TRIANGLE_BL: path.moveTo(x, y); path.lineTo(x, y + h); path.lineTo(x + w, y + h); path.closePath(); break;
            }
            ctx.fill(path);
            ctx.stroke(path);
        }
    }

    cropPattern(pattern) {
        let minRow = pattern.length, maxRow = -1, minCol = pattern[0].length, maxCol = -1;
        for (let r = 0; r < pattern.length; r++) {
            for (let c = 0; c < pattern[r].length; c++) {
                if (pattern[r][c] !== CellState.EMPTY) {
                    minRow = Math.min(minRow, r);
                    maxRow = Math.max(maxRow, r);
                    minCol = Math.min(minCol, c);
                    maxCol = Math.max(maxCol, c);
                }
            }
        }
        if (maxRow === -1) {
            return [[CellState.EMPTY]];
        }
        return pattern.slice(minRow, maxRow + 1).map(row => row.slice(minCol, maxCol + 1));
    }

    updateDesignerPreview() {
        const cropped = this.cropPattern(this.state.designerGridState);
        this.renderer.drawToolbarGem(this.designerPreviewCanvas, { gridPattern: cropped, color: COLORS.TRANSPARENT });
    }

    handleFinishDesign() {
        const cropped = this.cropPattern(this.state.designerGridState);
        if (cropped.length === 1 && cropped[0].length === 1 && cropped[0][0] === CellState.EMPTY) {
            return;
        }

        this.customDesignedShape = { gridPattern: cropped };

        const customShapeButton = this.customShapeSelector.querySelector("[data-shape-key='SHAPE_CUSTOM_DESIGN']");
        if (customShapeButton) {
            customShapeButton.classList.remove('shape-choice-add');
            const canvas = customShapeButton.querySelector('canvas');
            if (canvas) {
                this.renderer.drawToolbarGem(canvas, Object.assign({}, this.customDesignedShape, { color: COLORS.TRANSPARENT }));
            }

            this.state.selectedShapeKey = 'SHAPE_CUSTOM_DESIGN';
            this.customShapeSelector.querySelectorAll('.shape-choice').forEach(el => el.classList.remove('selected'));
            customShapeButton.classList.add('selected');
        }

        this._refreshPreview();
        this.closeDesigner();
    }

    handleAddCustomGem() {
        const { selectedColorKey, selectedShapeKey } = this.state;
        if (!selectedColorKey || !selectedShapeKey) {
            alert('Please select a color and a shape first.');
            return;
        }

        const shapeDef = (selectedShapeKey === 'SHAPE_CUSTOM_DESIGN' && this.customDesignedShape)
            ? Object.assign({}, this.customDesignedShape, { name: CUSTOM_SHAPES.SHAPE_CUSTOM_DESIGN.name })
            : CUSTOM_SHAPES[selectedShapeKey];

        if (!shapeDef || !shapeDef.gridPattern) return;

        const colorDef = BASE_COLORS[selectedColorKey];

        let finalGridPattern;
        if (selectedColorKey === 'BLACK') {
            finalGridPattern = shapeDef.gridPattern.map(row =>
                row.map(cell => (cell !== CellState.EMPTY ? CellState.ABSORB : CellState.EMPTY))
            );
        } else {
            finalGridPattern = shapeDef.gridPattern.map(row =>
                row.map(cell => (cell === CellState.ABSORB ? CellState.BLOCK : cell))
            );
        }

        const gemName = `CUSTOM_${selectedColorKey}_${selectedShapeKey}_${Date.now()}`;

        const newGemDef = Object.assign({}, colorDef, shapeDef, {
            gridPattern: finalGridPattern,
            name: gemName,
            originalColorKey: selectedColorKey,
        });

        this.state.gems.push(newGemDef);

        // If a custom design was used, clear it so the user can design another.
        if (selectedShapeKey === 'SHAPE_CUSTOM_DESIGN' && this.customDesignedShape) {
            this.customDesignedShape = null;
            this.state.selectedShapeKey = null;
            this.populateSelectors();
        }

        this.updateCustomGemList();
        this.validateCustomSet();
        this._refreshPreview();
    }

    updateCustomGemList() {
        this.customGemList.innerHTML = '';
        this.state.gems.forEach((gemDef, index) => {
            const item = document.createElement('div');
            item.className = 'custom-gem-item';
            const canvas = document.createElement('canvas');
            item.appendChild(canvas);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-gem-btn';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.title = 'Remove';
            deleteBtn.onclick = () => {
                this.state.gems.splice(index, 1);
                this.updateCustomGemList();
                this.validateCustomSet();
            };
            item.appendChild(deleteBtn);

            this.customGemList.appendChild(item);
            setTimeout(() => this.renderer.drawToolbarGem(canvas, gemDef), 0);
        });
    }

    validateCustomSet() {
        if (this._mode === 'board-creation') {
            // Designer mode: anything goes — pick whatever gems you want to place.
            this.customValidationFeedback.innerHTML = this.state.gems.length === 0
                ? `<div class="valid">Add at least one gem to continue.</div>`
                : `<div class="valid">✅ ${this.state.gems.length} gem(s) ready to place</div>`;
            this.btnStartCustomLevel.disabled = this.state.gems.length === 0;
            return;
        }

        const counts = this.state.gems.reduce((acc, gem) => {
            acc[gem.originalColorKey] = (acc[gem.originalColorKey] || 0) + 1;
            return acc;
        }, {});

        const validationRules = [
            { ok: (counts['RED']          || 0) === 1, message: 'Requires: <strong>exactly 1 red</strong> gem' },
            { ok: (counts['YELLOW']       || 0) === 1, message: 'Requires: <strong>exactly 1 yellow</strong> gem' },
            { ok: (counts['BLUE']         || 0) === 1, message: 'Requires: <strong>exactly 1 blue</strong> gem' },
            { ok: (counts['WHITE']        || 0) >= 1, message: 'Requires: <strong>at least 1 white</strong> gem' },
            { ok: (counts['WHITE']        || 0) <= 4, message: 'Allowed: <strong>maximum of 4 white</strong> gems' },
            { ok: (counts['LIGHT_RED']    || 0) <= 2, message: 'Allowed: <strong>maximum of 2 light red</strong> gems' },
            { ok: (counts['LIGHT_YELLOW'] || 0) <= 2, message: 'Allowed: <strong>maximum of 2 light yellow</strong> gems' },
            { ok: (counts['LIGHT_BLUE']   || 0) <= 2, message: 'Allowed: <strong>maximum of 2 light blue</strong> gems' },
            { ok: (counts['TRANSPARENT']  || 0) <= 4, message: 'Allowed: <strong>maximum of 4 transparent</strong> gems' },
            { ok: (counts['BLACK']        || 0) <= 1, message: 'Allowed: <strong>maximum of 1 black</strong> gem' },
        ];

        const firstError = validationRules.find(rule => !rule.ok);

        if (firstError) {
            this.customValidationFeedback.innerHTML = `<div class="invalid">❌ ${firstError.message}</div>`;
            this.btnStartCustomLevel.disabled = true;
        } else {
            this.customValidationFeedback.innerHTML = `<div class="valid">✅ Level is valid</div>`;
            this.btnStartCustomLevel.disabled = this.state.gems.length === 0;
        }
    }

    handleStartCustomLevel() {
        if (this.btnStartCustomLevel.disabled) return;

        const gemSet = this.state.gems.map(g => g.name);
        const gemDefinitions = Object.fromEntries(this.state.gems.map(g => [g.name, g]));
        const dims = { gridWidth: this._size.W, gridHeight: this._size.H };

        if (this._mode === 'board-creation') {
            this.game.startBoardCreation(dims, gemSet, gemDefinitions);
            return;
        }

        gameState.customGemSet = gemSet;
        gameState.customGemDefinitions = gemDefinitions;
        this.game.start(LEVELS.CUSTOM, dims);
    }

    setMode(mode) {
        this._mode = mode;
        const isBoardCreation = (mode === 'board-creation');
        this.btnStartCustomLevel.textContent = isBoardCreation ? 'Place gems' : 'Start Level';
    }
}
