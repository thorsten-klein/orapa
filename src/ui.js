'use strict';

class UI {
    constructor() {
        this.screens = {};
        this._historyInited = false;
        this._navigatingBack = false;
        this.cacheDOMElements();
        this.bindGlobalEvents();
        window.addEventListener('popstate', (e) => this._handlePopState(e));
    }

    _handlePopState(e) {
        const screen = (e.state && e.state.screen) || 'main';
        this._navigatingBack = true;
        try {
            if (screen === 'level') this.game.showLevelSelect();
            else if (screen === 'custom-creator') this.game.showCustomCreator();
            else if (screen === 'game') {
                if (gameState.level && this.game.hasActiveGameForLevel(gameState.level)) {
                    this.game.resume(gameState.level);
                } else this.game.showMainMenu();
            } else {
                this.game.showMainMenu();
            }
        } finally {
            this._navigatingBack = false;
        }
    }

    bindGame(gameInstance) {
        this.game = gameInstance;
        this.renderer = new Renderer(this.game, this);
        this.inputHandler = new InputHandler(this.game, this);
        this.customCreatorUI = new CustomCreatorUI(this.game, this.renderer);

        this.renderer.connectInputHandler(this.inputHandler);
        this.inputHandler.connectRenderer(this.renderer);

        // Initial population of dynamic content (rules, etc.) on the menu screen
        this._populateIntroRules();
    }

    cacheDOMElements() {
        this.screens.main = document.getElementById('screen-main');
        this.screens.level = document.getElementById('screen-level');
        this.screens['custom-creator'] = document.getElementById('screen-custom-creator');
        this.screens.game = document.getElementById('screen-game');
        this.endModal = document.getElementById('screen-end');

        this.btnStartGame = document.getElementById('btn-start-game');
        this.btnResumeGame = document.getElementById('btn-resume-game');
        this.btnResetAll = document.getElementById('btn-reset-all');
        this.resetConfirmModal = document.getElementById('reset-confirm-modal');
        this.btnConfirmReset = document.getElementById('btn-confirm-reset');
        this.btnCancelReset = document.getElementById('btn-cancel-reset');
        this.introRulesEl = document.getElementById('intro-rules');

        this.levelOptions = document.getElementById('level-options');
        this.levelTitle = document.getElementById('level-title');
        this.orientSwitch = document.getElementById('orientation-switch-container');
        this.orientPortrait = document.getElementById('orient-portrait');
        this.orientLandscape = document.getElementById('orient-landscape');
        this.btnBackToMain1 = document.getElementById('btn-back-to-main-1');
        this.btnBackToLevel = document.getElementById('btn-back-to-level');

        this.gemToolbar = document.getElementById('gem-toolbar');
        this.gemToolbarWrapper = document.getElementById('gem-toolbar-wrapper');
        this.colorPaletteWrapper = document.getElementById('color-palette-wrapper');
        this.colorPalette = document.getElementById('color-palette');
        this.logList = document.getElementById('log-list');
        this.logEmptyMsg = document.getElementById('log-empty-msg');
        this.actionButtons = document.getElementById('action-buttons');
        this.checkSolutionBtn = document.getElementById('check-solution-btn');
        this.giveUpBtn = document.getElementById('give-up-btn');
        this.modeWaveBtn = document.getElementById('mode-wave-btn');
        this.modeQueryBtn = document.getElementById('mode-query-btn');
        this.queryCounter = document.getElementById('query-counter');
        this.pathSwitchWrapper = document.getElementById('path-switch-wrapper');
        this.pathShowBtn = document.getElementById('path-show-btn');
        this.pathHideBtn = document.getElementById('path-hide-btn');
        this.playerPathSwitchWrapper = document.getElementById('player-path-switch-wrapper');
        this.playerPathShowBtn = document.getElementById('player-path-show-btn');
        this.playerPathHideBtn = document.getElementById('player-path-hide-btn');

        this.endTitle = document.getElementById('end-title');
        this.endRating = document.getElementById('end-rating');
        this.endStats = document.getElementById('end-stats');
        this.endRetryMessage = document.getElementById('end-retry-message');
        this.endSolutionLabel = document.getElementById('end-solution-label');
        this.endRatingLegend = document.getElementById('end-rating-legend');
        this.btnNewLevel = document.getElementById('btn-new-level');
        this.btnMenu = document.getElementById('btn-menu');
        this.btnDownloadCorrect = document.getElementById('btn-download-correct');
        this.btnDownloadYours = document.getElementById('btn-download-yours');

        this.btnBack = document.getElementById('btn-back');
        this.btnInfo = document.getElementById('btn-info');
        this.btnHistory = document.getElementById('btn-history');
        this.btnShare = document.getElementById('btn-share');
        this.btnFullscreen = document.getElementById('btn-fullscreen');
        this.btnUndo = document.getElementById('btn-undo');
        this.btnRedo = document.getElementById('btn-redo');
        this.infoModal = document.getElementById('info-modal');
        this.infoModalMethods = document.getElementById('info-modal-methods');
        this.infoModalMixing = document.getElementById('info-modal-mixing');
        this.infoModalRating = document.getElementById('info-modal-rating');
        this.btnCloseInfo = document.getElementById('btn-close-info');
        this.logbookModal = document.getElementById('logbook-modal');
        this.btnCloseLogbook = document.getElementById('btn-close-logbook');

        // Game Sheet
        this.finishGameBtn = document.getElementById('finish-game-btn');
        this.rayResultModal = document.getElementById('ray-result-modal');
        this.rayResultTitle = document.getElementById('ray-result-title');
        this.rayExitButtons = document.getElementById('ray-exit-buttons');
        this.rayColorGrid = document.getElementById('ray-color-grid');
        this.btnRaySave = document.getElementById('btn-ray-save');
        this.btnRayDelete = document.getElementById('btn-ray-delete');
        this.btnRayCancel = document.getElementById('btn-ray-cancel');
        this.queryResultModal = document.getElementById('query-result-modal');
        this.queryResultTitle = document.getElementById('query-result-title');
        this.queryColorGrid = document.getElementById('query-color-grid');
        this.btnQuerySave = document.getElementById('btn-query-save');
        this.btnQueryDelete = document.getElementById('btn-query-delete');
        this.btnQueryCancel = document.getElementById('btn-query-cancel');
        this.finishConfirmModal = document.getElementById('finish-confirm-modal');
        this.btnConfirmFinish = document.getElementById('btn-confirm-finish');
        this.btnCancelFinish = document.getElementById('btn-cancel-finish');
        this.addGemModal = document.getElementById('add-gem-modal');
        this.addGemColorSelector = document.getElementById('add-gem-color-selector');
        this.addGemShapeSelector = document.getElementById('add-gem-shape-selector');
        this.btnAddGemSave = document.getElementById('btn-add-gem-save');
        this.btnAddGemCancel = document.getElementById('btn-add-gem-cancel');
        this.playFriendsModal = document.getElementById('play-friends-modal');
        this.playFriendsInput = document.getElementById('play-friends-input');
        this.btnPlayFriendsPaste = document.getElementById('btn-play-friends-paste');
        this.btnPlayFriendsStart = document.getElementById('btn-play-friends-start');
        this.btnPlayFriendsCancel = document.getElementById('btn-play-friends-cancel');
        this.endShareSection = document.getElementById('end-share-section');
        this.endShareUrl = document.getElementById('end-share-url');
        this.endShareGameId = document.getElementById('end-share-game-id');
        this.btnEndCopyUrl = document.getElementById('btn-end-copy-url');
        this.btnEndCopyGameId = document.getElementById('btn-end-copy-game-id');
        this.btnEndShareViaApp = document.getElementById('btn-end-share-via-app');
        this.shareBoardModal = document.getElementById('share-board-modal');
        this.shareBoardUrl = document.getElementById('share-board-url');
        this.shareBoardGameId = document.getElementById('share-board-game-id');
        this.btnShareCopyUrl = document.getElementById('btn-share-copy-url');
        this.btnShareCopyGameId = document.getElementById('btn-share-copy-game-id');
        this.btnShareViaApp = document.getElementById('btn-share-via-app');
        this.btnShareClose = document.getElementById('btn-share-close');
    }

    bindGlobalEvents() {
        this.btnBack.addEventListener('click', () => this.game.showMainMenu());
        this.btnFullscreen.addEventListener('click', () => this.toggleFullscreen());
        document.addEventListener('fullscreenchange', () => this.updateFullscreenIcon());
        this.btnInfo.addEventListener('click', () => this.openInfoModal());
        this.btnCloseInfo.addEventListener('click', () => this.closeInfoModal());
        this.infoModal.addEventListener('click', (e) => {
            if (e.target === this.infoModal) this.closeInfoModal();
        });
        this.btnUndo.addEventListener('click', () => this.game.undo());
        this.btnRedo.addEventListener('click', () => this.game.redo());
        this.btnHistory.addEventListener('click', () => this.openLogbookModal());
        this.btnCloseLogbook.addEventListener('click', () => this.closeLogbookModal());
        this.logbookModal.addEventListener('click', (e) => {
            if (e.target === this.logbookModal) this.closeLogbookModal();
        });

        this.btnStartGame.addEventListener('click', () => {
            this._levelMode = 'start';
            this.game.showLevelSelect();
        });
        this.btnResumeGame.addEventListener('click', () => {
            this._levelMode = 'resume';
            this.game.showLevelSelect();
        });
        this.orientPortrait.addEventListener('click', () => {
            this._selectedOrientation = 'portrait';
            this._updateOrientationButtons();
        });
        this.orientLandscape.addEventListener('click', () => {
            this._selectedOrientation = 'landscape';
            this._updateOrientationButtons();
        });

        this.btnResetAll.addEventListener('click', () => this.resetConfirmModal.classList.remove('hidden'));
        this.btnCancelReset.addEventListener('click', () => this.resetConfirmModal.classList.add('hidden'));
        this.resetConfirmModal.addEventListener('click', (e) => {
            if (e.target === this.resetConfirmModal) this.resetConfirmModal.classList.add('hidden');
        });
        this.btnConfirmReset.addEventListener('click', () => {
            this.game.resetAllGames();
            this.resetConfirmModal.classList.add('hidden');
            this.btnResumeGame.hidden = true;
            this.btnResetAll.hidden = true;
        });
        this.btnNewLevel.addEventListener('click', () => {
            if (gameState.level) this.game.start(gameState.level);
        });
        this.btnMenu.addEventListener('click', () => this.game.showMainMenu());
        this.btnDownloadCorrect.addEventListener('click', () => this._downloadEndSolution('correct'));
        this.btnDownloadYours.addEventListener('click', () => this._downloadEndSolution('player'));
        this.btnBackToMain1.addEventListener('click', () => this.game.showMainMenu());
        this.btnBackToLevel.addEventListener('click', () => this.game.showLevelSelect());

        this.checkSolutionBtn.addEventListener('click', () => this.game.checkSolution());
        this.giveUpBtn.addEventListener('click', () => this.game.giveUp());
        this.modeWaveBtn.addEventListener('click', () => this.game.setInteractionMode(InteractionMode.WAVE));
        this.modeQueryBtn.addEventListener('click', () => this.game.setInteractionMode(InteractionMode.QUERY));
        this.pathShowBtn.addEventListener('click', () => this.game.setReflectionPath(true));
        this.pathHideBtn.addEventListener('click', () => this.game.setReflectionPath(false));
        this.playerPathShowBtn.addEventListener('click', () => this.game.setPlayerPathPreview(true));
        this.playerPathHideBtn.addEventListener('click', () => this.game.setPlayerPathPreview(false));

        this.finishGameBtn.addEventListener('click', () => this.finishConfirmModal.classList.remove('hidden'));
        this.btnCancelFinish.addEventListener('click', () => this.finishConfirmModal.classList.add('hidden'));
        this.finishConfirmModal.addEventListener('click', (e) => {
            if (e.target === this.finishConfirmModal) this.finishConfirmModal.classList.add('hidden');
        });
        this.btnConfirmFinish.addEventListener('click', () => {
            this.finishConfirmModal.classList.add('hidden');
            this.game.finishGameSheet();
        });

        this.btnRayCancel.addEventListener('click', () => this._closeRayModal());
        this.rayResultModal.addEventListener('click', (e) => {
            if (e.target === this.rayResultModal) this._closeRayModal();
        });
        this.btnRaySave.addEventListener('click', () => this._submitRayModal());
        this.btnRayDelete.addEventListener('click', () => this._deleteFromRayModal());

        this.btnQueryCancel.addEventListener('click', () => this._closeQueryModal());
        this.queryResultModal.addEventListener('click', (e) => {
            if (e.target === this.queryResultModal) this._closeQueryModal();
        });
        this.btnQuerySave.addEventListener('click', () => this._submitQueryModal());
        this.btnQueryDelete.addEventListener('click', () => this._deleteFromQueryModal());

        this.btnAddGemCancel.addEventListener('click', () => this._closeAddGemModal());
        this.addGemModal.addEventListener('click', (e) => {
            if (e.target === this.addGemModal) this._closeAddGemModal();
        });
        this.btnAddGemSave.addEventListener('click', () => this._submitAddGemModal());

        this.btnPlayFriendsCancel.addEventListener('click', () => this._closePlayFriendsModal());
        this.playFriendsModal.addEventListener('click', (e) => {
            if (e.target === this.playFriendsModal) this._closePlayFriendsModal();
        });
        this.btnPlayFriendsStart.addEventListener('click', () => this._submitPlayFriendsModal());
        this.btnPlayFriendsPaste.addEventListener('click', () => this._pastePlayFriendsInput());

        this.btnEndCopyUrl.addEventListener('click', () => this._copyToClipboard(this.endShareUrl, this.btnEndCopyUrl));
        this.btnEndCopyGameId.addEventListener('click', () => this._copyToClipboard(this.endShareGameId, this.btnEndCopyGameId));
        this.btnEndShareViaApp.addEventListener('click', () => this._shareViaApp(this.endShareUrl.value, this.btnEndShareViaApp));

        this.btnShare.addEventListener('click', () => this.openShareBoardModal());
        this.btnShareClose.addEventListener('click', () => this._closeShareBoardModal());
        this.shareBoardModal.addEventListener('click', (e) => {
            if (e.target === this.shareBoardModal) this._closeShareBoardModal();
        });
        this.btnShareCopyUrl.addEventListener('click', () => this._copyToClipboard(this.shareBoardUrl, this.btnShareCopyUrl));
        this.btnShareCopyGameId.addEventListener('click', () => this._copyToClipboard(this.shareBoardGameId, this.btnShareCopyGameId));
        this.btnShareViaApp.addEventListener('click', () => this._shareViaApp(this.shareBoardUrl.value, this.btnShareViaApp));

        // Reveal the native-share buttons only on browsers that actually support it.
        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
            this.btnShareViaApp.hidden = false;
            this.btnEndShareViaApp.hidden = false;
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.infoModal.classList.contains('hidden')) {
                this.closeInfoModal();
                return;
            }
            if (e.key === 'Escape' && !this.logbookModal.classList.contains('hidden')) {
                this.closeLogbookModal();
                return;
            }
            if (e.key === 'n' && (gameState.status === GameStatus.PLAYING || gameState.status === GameStatus.GAME_OVER)) {
                if (gameState.level) this.game.start(gameState.level);
                return;
            }
            if (e.key === 'Escape' && (gameState.status === GameStatus.PLAYING || gameState.status === GameStatus.GAME_OVER || gameState.status === GameStatus.CUSTOM_CREATOR || gameState.status === GameStatus.LEVEL_SELECT)) {
                this.game.showMainMenu();
                return;
            }
            if (gameState.status === GameStatus.PLAYING) {
                const mod = e.ctrlKey || e.metaKey;
                if (mod && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
                    e.preventDefault();
                    this.game.undo();
                    return;
                }
                if (mod && ((e.shiftKey && (e.key === 'z' || e.key === 'Z')) || e.key === 'y' || e.key === 'Y')) {
                    e.preventDefault();
                    this.game.redo();
                    return;
                }
                if (e.key === 'd') this.game.toggleDebugMode();
                if ((e.key === 'f' || e.key === 'F') && !this.playerPathSwitchWrapper.hidden) {
                    this.game.togglePlayerPathPreview();
                }
            }
        });

        this.logList.addEventListener('animationend', () => {
            this.logList.classList.remove('flash');
        });

        const wideMQ = window.matchMedia('(min-width: 720px)');
        const updateIntroDetails = () => {
            const details = this.introRulesEl.querySelectorAll('.rules-details');
            details.forEach(d => {
                if (wideMQ.matches) d.setAttribute('open', '');
            });
        };
        wideMQ.addEventListener('change', updateIntroDetails);
        updateIntroDetails();
    }

    setupGameUI() {
        this.updateInteractionModeUI(gameState.interactionMode);
        this.updatePathSwitchUI(gameState.showReflectionPath);
        this.pathSwitchWrapper.hidden = (gameState.level !== LEVELS.TRAINING);
        this.updatePlayerPathSwitchUI(gameState.showPlayerPathPreview);
        this._applyPlayerPathWrapperVisibility();
        this.renderer.setupEmitters();
        this._setupToolboxForLevel();
        this.logList.innerHTML = '';
        this.updateLogEmptyState();
        this.updateQueryCounter();
        this._applyGameSheetUI();
        this.renderer.clearPath();
        this.game.updateSolutionButtonState();
        this.renderer.handleResize();
    }

    _applyGameSheetUI() {
        const isSheet = this.game.isGameSheet();
        const isBoardCreation = this.game.isBoardCreation();
        this.finishGameBtn.hidden = !isSheet;
        this.checkSolutionBtn.hidden = isSheet || isBoardCreation;
        this.giveUpBtn.hidden = isSheet || isBoardCreation;
        if (isSheet || isBoardCreation) this.pathSwitchWrapper.hidden = true;
        this._applyPlayerPathWrapperVisibility();
    }

    _applyPlayerPathWrapperVisibility() {
        // Hide on modes where there's no meaningful player path to preview.
        const hide = this.game.isGameSheet() || this.game.isBoardCreation()
            || gameState.level === LEVELS.EXTREME;
        this.playerPathSwitchWrapper.hidden = !!hide;
    }

    // Re-render the game screen from existing gameState (used by Resume).
    refreshGameUI() {
        this.updateInteractionModeUI(gameState.interactionMode);
        this.updatePathSwitchUI(gameState.showReflectionPath);
        this.pathSwitchWrapper.hidden = (gameState.level !== LEVELS.TRAINING);
        this.updatePlayerPathSwitchUI(gameState.showPlayerPathPreview);
        this._applyPlayerPathWrapperVisibility();
        this.renderer.setupEmitters();
        // Re-apply emitter used-state from the existing log.
        for (const logEntry of gameState.log) {
            if (logEntry.type === InteractionMode.WAVE) {
                this.renderer.updateEmitterFromLog(logEntry);
            }
        }
        this._setupToolboxForLevel();
        this.refreshLog();
        this.updateLogEmptyState();
        this.updateQueryCounter();
        this._applyGameSheetUI();
        this.updateUndoRedoState();
        this.game.updateSolutionButtonState();
        this.renderer.handleResize();
    }

    _dimsForOrientation() {
        return this._selectedOrientation === 'landscape'
            ? { gridWidth: 10, gridHeight: 8 }
            : { gridWidth: 8, gridHeight: 10 };
    }

    showScreen(screenName) {
        if (screenName === 'level') this.populateLevelOptions();
        if (screenName === 'custom-creator') {
            this.customCreatorUI.setMode(this.game._customCreatorMode || 'custom');
            this.customCreatorUI.setup(this._dimsForOrientation());
        }

        Object.values(this.screens).forEach(s => s.classList.add('hidden'));
        this.screens[screenName].classList.remove('hidden');
        // Always dismiss the end-result modal when navigating elsewhere.
        if (this.endModal) this.endModal.classList.add('hidden');

        if (!this._navigatingBack && screenName !== 'end') {
            if (this._historyInited) {
                try { history.pushState({ screen: screenName }, ''); } catch (e) { /* ignore */ }
            } else {
                try { history.replaceState({ screen: screenName }, ''); } catch (e) { /* ignore */ }
                this._historyInited = true;
            }
        }

        const inGame = (screenName === 'game');
        this.btnBack.hidden = (screenName === 'main');
        this.btnInfo.hidden = !inGame;
        this.btnHistory.hidden = !inGame;
        this.btnUndo.hidden = !inGame;
        this.btnRedo.hidden = !inGame;
        this.btnShare.hidden = !(inGame && this.game && this.game.isShareableLevel(gameState.level));
        this.actionButtons.hidden = !inGame;
        // Renderer needs to recompute available height once the bar appears/disappears.
        requestAnimationFrame(() => this.renderer && this.renderer.handleResize());
        if (inGame) this.updateUndoRedoState();
        if (screenName === 'main') {
            const anyActive = this.game.hasAnyActiveGame();
            this.btnResumeGame.hidden = !anyActive;
            this.btnResetAll.hidden = !anyActive;
        }

        if (inGame) {
            const gemCanvas = document.getElementById('gem-canvas');
            if (gemCanvas) gemCanvas.focus();
        }
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => { /* ignored */ });
        } else if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }

    updateFullscreenIcon() {
        document.body.classList.toggle('is-fullscreen', !!document.fullscreenElement);
    }

    openInfoModal() {
        this._renderRating(this.infoModalRating);
        this._renderRules(this.infoModalMethods, this.infoModalMixing);
        this.infoModal.classList.remove('hidden');
    }

    closeInfoModal() {
        this.infoModal.classList.add('hidden');
    }

    openLogbookModal() {
        this.updateLogEmptyState();
        this.logbookModal.classList.remove('hidden');
    }

    closeLogbookModal() {
        this.logbookModal.classList.add('hidden');
    }

    updateLogEmptyState() {
        if (!this.logEmptyMsg) return;
        this.logEmptyMsg.style.display = gameState.log.length > 0 ? 'none' : 'block';
    }

    updateQueryCounter() {
        if (!this.queryCounter) return;
        this.queryCounter.textContent = `Queries: ${gameState.waveCount || 0}`;
    }

    updateUndoRedoState() {
        if (!this.game) return;
        this.btnUndo.disabled = !this.game.canUndo();
        this.btnRedo.disabled = !this.game.canRedo();
    }

    populateLevelOptions() {
        this.levelOptions.innerHTML = '';
        const isResume = (this._levelMode === 'resume');
        this.levelTitle.textContent = isResume ? 'Resume game' : 'Start new game';

        // Default the orientation to match the current viewport on every visit.
        this._selectedOrientation = (window.innerWidth > window.innerHeight) ? 'landscape' : 'portrait';
        this._updateOrientationButtons();
        this.orientSwitch.hidden = isResume;

        const makeLevelBtn = (levelKey, onStart) => {
            const btn = document.createElement('button');
            const active = this.game.hasActiveGameForLevel(levelKey);
            let extra = '';
            if (isResume && !active) extra = `<div class="level-info">No game in progress.</div>`;
            else if (!isResume && active) extra = `<div class="level-warn">Current ${LEVEL_LABELS[levelKey]} game will be ended.</div>`;
            btn.innerHTML = `${LEVEL_LABELS[levelKey]}<div class="level-desc">${LEVEL_DESCRIPTIONS[levelKey]}</div>${extra}`;
            if (isResume) {
                if (active) btn.onclick = () => this.game.resume(levelKey);
                else btn.disabled = true;
            } else {
                btn.onclick = onStart;
            }
            return btn;
        };

        const addGroup = (title, items) => {
            const visible = items.filter(Boolean);
            if (visible.length === 0) return;
            const group = document.createElement('div');
            group.className = 'level-group';
            const heading = document.createElement('h4');
            heading.className = 'level-group-title';
            heading.textContent = title;
            group.appendChild(heading);
            const grid = document.createElement('div');
            grid.className = 'level-group-options';
            visible.forEach(item => grid.appendChild(item));
            group.appendChild(grid);
            this.levelOptions.appendChild(group);
        };

        // --- Training ---
        const trainingBtn = makeLevelBtn(LEVELS.TRAINING, () => this.game.start(LEVELS.TRAINING, this._dimsForOrientation()));
        addGroup('Training', [trainingBtn]);

        // --- Difficulties ---
        const diffBtns = [LEVELS.NORMAL, LEVELS.MEDIUM, LEVELS.HARD, LEVELS.EXTREME].map(lvl =>
            makeLevelBtn(lvl, () => this.game.start(lvl, this._dimsForOrientation()))
        );
        addGroup('Difficulties', diffBtns);

        // --- Others ---
        const customBtn = makeLevelBtn(LEVELS.CUSTOM, () => this.game.showCustomCreator('custom'));
        const sheetBtn = makeLevelBtn(LEVELS.GAME_SHEET, () => this.game.start(LEVELS.GAME_SHEET, this._dimsForOrientation()));
        const boardCreationBtn = makeLevelBtn(LEVELS.BOARD_CREATION, () => this.game.showCustomCreator('board-creation'));

        let friendsBtn = null;
        if (!isResume) {
            friendsBtn = document.createElement('button');
            friendsBtn.innerHTML = `Play against Friends<div class="level-desc">Join a shared board by pasting a game ID or URL.</div>`;
            friendsBtn.onclick = () => this.openPlayFriendsModal();
        }

        addGroup('Others', [customBtn, sheetBtn, boardCreationBtn, friendsBtn]);
    }

    updateInteractionModeUI(mode) {
        this.modeWaveBtn.classList.toggle('active', mode === InteractionMode.WAVE);
        this.modeQueryBtn.classList.toggle('active', mode === InteractionMode.QUERY);
    }

    _updateOrientationButtons() {
        this.orientPortrait.classList.toggle('active', this._selectedOrientation === 'portrait');
        this.orientLandscape.classList.toggle('active', this._selectedOrientation === 'landscape');
    }

    updatePathSwitchUI(showing) {
        this.pathShowBtn.classList.toggle('active', showing);
        this.pathHideBtn.classList.toggle('active', !showing);
    }

    updatePlayerPathSwitchUI(showing) {
        this.playerPathShowBtn.classList.toggle('active', showing);
        this.playerPathHideBtn.classList.toggle('active', !showing);
    }

    populateColorPalette() {
        this.colorPalette.innerHTML = '';
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
            div.onclick = () => this.game.setDrawColor(key);
            this.colorPalette.appendChild(div);
        });
    }

    updateDrawColorUI() {
        const sel = gameState.drawSelectedColor;
        this.colorPalette.querySelectorAll('.color-choice').forEach(el => {
            el.classList.toggle('selected', el.dataset.colorKey === sel);
        });
    }

    _setupToolboxForLevel() {
        const extreme = (gameState.level === LEVELS.EXTREME);
        this.gemToolbarWrapper.hidden = extreme;
        this.colorPaletteWrapper.hidden = !extreme;
        if (extreme) {
            this.populateColorPalette();
            this.updateDrawColorUI();
        } else {
            this.updateToolbar();
        }
    }

    getGemDefinition(gemName) {
        const isCustom = gameState.level === LEVELS.CUSTOM;
        if (isCustom) return gameState.customGemDefinitions[gemName];
        return GEMS[gemName] || gameState.customGemDefinitions[gemName];
    }

    getGemTooltip(gemName) {
        const gemDef = this.getGemDefinition(gemName);
        if (!gemDef) return '';

        if (gemDef.special === 'absorbs') return 'Absorbs light.';
        if (gemDef.baseGems.length === 0) return 'Only reflects, does not color.';
        if (gemDef.baseGems.length === 1) {
            const baseColor = BASE_COLORS[gemDef.baseGems[0]];
            const colorName = baseColor ? baseColor.name.toLowerCase() : '';
            return `Adds '${colorName}' color.`;
        }
        const mixName = (COLOR_COMBO_NAMES[colorComboKey(gemDef.baseGems)] || 'mixed').toLowerCase();
        return `Adds '${mixName}' color.`;
    }

    updateToolbar() {
        this.gemToolbar.innerHTML = '';
        if (!gameState.level) return;

        const isCustom = gameState.level === LEVELS.CUSTOM;
        const isSheet = this.game && this.game.isGameSheet();
        const isBoardCreation = this.game && this.game.isBoardCreation();
        const useCustomSet = isCustom || isBoardCreation;
        const baseSet = useCustomSet ? gameState.customGemSet : (GEM_SETS[gameState.level] || []);
        const extraSet = (!useCustomSet && isSheet) ? gameState.customGemSet : [];
        const gemSet = baseSet.concat(extraSet);
        if (gemSet.length === 0 && !isSheet) return;

        const placedGemNames = new Set(gameState.playerGems.map(g => g.name));

        gemSet.forEach(gemName => {
            const gemDef = this.getGemDefinition(gemName);
            if (!gemDef) return;

            const div = document.createElement('div');
            div.className = 'toolbar-gem';
            if (placedGemNames.has(gemName)) div.classList.add('placed');
            div.dataset.gemName = gemName;
            div.title = this.getGemTooltip(gemName);
            const canvas = document.createElement('canvas');
            canvas.className = 'toolbar-gem-canvas';
            div.appendChild(canvas);

            // Game Sheet: custom-added gems get a small remove (×) button.
            if (isSheet && extraSet.includes(gemName)) {
                const rm = document.createElement('button');
                rm.className = 'toolbar-gem-remove';
                rm.type = 'button';
                rm.setAttribute('aria-label', 'Remove gem');
                rm.textContent = '×';
                rm.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    this.game.removeGameSheetCustomGem(gemName);
                });
                rm.addEventListener('mousedown', (e) => e.stopPropagation());
                rm.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
                div.appendChild(rm);
            }

            this.gemToolbar.appendChild(div);
            setTimeout(() => this.renderer.drawToolbarGem(canvas, gemDef), 0);
        });

        if (isSheet) {
            const addTile = document.createElement('button');
            addTile.type = 'button';
            addTile.className = 'toolbar-gem toolbar-gem-add';
            addTile.title = 'Add a custom gem';
            addTile.setAttribute('aria-label', 'Add gem');
            addTile.textContent = '+';
            addTile.addEventListener('click', () => this.openAddGemModal());
            this.gemToolbar.appendChild(addTile);
        }
    }

    handleSelectionChange() {
        this.redrawAll();
        this.updateLogHighlight();
    }

    redrawAll() {
        if (!this.renderer) return;
        this.renderer.redrawAll();
        this._schedulePersist();
    }

    _schedulePersist() {
        if (!this.game || gameState.status !== GameStatus.PLAYING) return;
        if (this._persistTimer) clearTimeout(this._persistTimer);
        this._persistTimer = setTimeout(() => {
            this._persistTimer = null;
            this.game._persistCurrentGame();
        }, 250);
    }

    addLogEntry(logEntry) {
        const li = this.createLogEntryElement(logEntry, true);
        this.logList.prepend(li);
        this.updateLogEmptyState();
        this.updateQueryCounter();
    }

    createLogEntryElement(logEntry, updateEmitter) {
        const li = document.createElement('li');
        li.dataset.logId = logEntry.id;

        if (logEntry.type === InteractionMode.WAVE) {
            if (updateEmitter) this.renderer.updateEmitterFromLog(logEntry);
            const { result } = logEntry;
            const resultText = `${emitterDisplayLabel(logEntry.id)} ➔ ${emitterDisplayLabel(result.exitId)}`;
            const resultColor = this.renderer.getPathColor(result);
            const colorName = this.getPathColorName(result);
            li.innerHTML = `<span>${resultText}</span><div class="log-entry-result"><span class="log-color-name">${colorName}</span><div class="log-color-box" style="background-color: ${resultColor};"></div></div>`;
        } else {
            const { coords, result } = logEntry;
            const resultColor = result.colorHex || 'transparent';
            const colorName = result.colorName || 'Empty';
            const queryText = `Query (${coords.x + 1},${coords.y + 1})`;
            const boxStyle = `background-color: ${resultColor};` +
                             (this.renderer.isTransparentColor(resultColor) ? 'border-color: #a4d4e4;' : '');
            li.innerHTML = `<span>${queryText}</span><div class="log-entry-result"><span class="log-color-name">${colorName}</span><div class="log-color-box" style="${boxStyle}"></div></div>`;
        }

        if (this.game && this.game.isGameSheet()) {
            const editBtn = document.createElement('button');
            editBtn.className = 'log-edit-btn';
            editBtn.setAttribute('aria-label', 'Edit');
            editBtn.textContent = '✏️';
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeLogbookModal();
                if (logEntry.type === InteractionMode.WAVE) {
                    this.openRayResultModal(logEntry.id, logEntry);
                } else {
                    this.openQueryResultModal(logEntry.coords.x, logEntry.coords.y, logEntry);
                }
            });
            const resultBlock = li.querySelector('.log-entry-result');
            if (resultBlock) resultBlock.appendChild(editBtn);
        }
        return li;
    }

    refreshLog() {
        this.logList.innerHTML = '';
        for (let i = gameState.log.length - 1; i >= 0; i--) {
            const li = this.createLogEntryElement(gameState.log[i], false);
            this.logList.appendChild(li);
        }
        this.updateLogHighlight();
    }

    areGemSetsIdentical(gemsA, gemsB) {
        if (gemsA.length !== gemsB.length) return false;

        const gemToKey = (g) => `${g.name},${g.x},${g.y},${JSON.stringify(g.gridPattern)}`;
        const keysA = new Set(gemsA.map(gemToKey));
        const keysB = new Set(gemsB.map(gemToKey));

        if (keysA.size !== keysB.size) return false;

        for (const key of keysA) {
            if (!keysB.has(key)) return false;
        }

        return true;
    }

    showEndScreen(isWin, waveCount, secretGems, playerGems, elapsedMs) {
        this.endTitle.classList.remove('win', 'loss');
        this.endRetryMessage.textContent = '';
        this.endRating.textContent = '';
        this.endRatingLegend.innerHTML = '';
        this.endRating.style.display = 'none';
        this.endRatingLegend.style.display = 'none';

        const timeStr = this._formatElapsed(elapsedMs);

        let playerSolutionToShow = [];

        if (isWin) {
            this.endTitle.textContent = 'You Win!';
            this.endTitle.classList.add('win');
            this.endStats.textContent = `You solved the mine in ${waveCount} queries and ${timeStr}.`;

            const areSolutionsIdentical = this.areGemSetsIdentical(secretGems, playerGems);
            if (areSolutionsIdentical) {
                this.endSolutionLabel.textContent = 'Correct Solution:';
                playerSolutionToShow = [];
            } else {
                this.endSolutionLabel.textContent = 'Alternative solution found! Your solution (transparent):';
                playerSolutionToShow = playerGems;
            }

            const level = gameState.level;
            if (level && RATINGS[level]) {
                const ratingTiers = RATINGS[level];
                const winningTier = ratingTiers.find(tier => waveCount <= tier.limit);
                if (winningTier) {
                    this.endRating.textContent = winningTier.text;
                    this.endRating.style.display = 'block';
                    this.endRatingLegend.style.display = 'block';
                    this.endRatingLegend.innerHTML =
                        `<h5>Rating for ${LEVEL_LABELS[level]}</h5>` +
                        this._buildRatingTableHtml(ratingTiers);
                }
            }
        } else {
            this.endTitle.textContent = 'You Lose!';
            this.endTitle.classList.add('loss');
            this.endStats.textContent = `You did not find the solution after ${waveCount} queries and ${timeStr}.`;
            this.endRetryMessage.textContent = 'Please try again.';
            this.endSolutionLabel.textContent = 'Your input (over the correct solution):';
            playerSolutionToShow = playerGems;
        }

        // Stash gems so the download buttons can re-render them on demand.
        this._endSecretGems = secretGems;
        this._endPlayerGems = playerGems;
        this.btnDownloadYours.hidden = !playerGems || playerGems.length === 0;

        this.updateEndShareSection();

        // End is a modal overlay — leave the game screen underneath intact.
        this.endModal.classList.remove('hidden');
        // Reset scroll so the user always sees the win/lose headline first.
        this.endModal.scrollTop = 0;
        requestAnimationFrame(() => {
            this.endModal.scrollTop = 0;
            this.renderer.drawEndScreenSolution(secretGems, playerSolutionToShow);
        });
    }

    _downloadEndSolution(which) {
        const gems = which === 'correct' ? this._endSecretGems : this._endPlayerGems;
        if (!gems) return;
        const off = document.createElement('canvas');
        this.renderer.drawSolutionTo(off, gems);
        off.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = which === 'correct' ? 'orapa-correct-solution.jpg' : 'orapa-your-solution.jpg';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 'image/jpeg', 0.92);
    }

    updateLogHighlight() {
        this.logList.querySelectorAll('li').forEach(li => {
            if (li.dataset.logId === gameState.selectedLogEntryId) {
                li.classList.add('selected');
                li.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                li.classList.remove('selected');
            }
        });
    }

    getPathColorName(result) {
        if (result.absorbed) return 'Absorbed';
        if (result.colors.length === 0) return 'No Color';
        return COLOR_COMBO_NAMES[colorComboKey(result.colors)] || 'Unknown Mix';
    }

    createColorMixEntry(key) {
        const resultColor = COLOR_MIXING[key];
        const baseColors = key.split(',');
        const entryDiv = document.createElement('div');
        entryDiv.className = 'color-mix-entry';

        let html = '';
        baseColors.forEach((colorName, index) => {
            const colorHex = this.renderer.getBaseColorHex(colorName);
            html += `<div class="color-mix-box" style="background-color: ${colorHex}"></div>`;
            if (index < baseColors.length - 1) {
                html += `<span>+</span>`;
            }
        });

        const resultName = COLOR_COMBO_NAMES[key] || 'Unknown Mix';
        html += `<span>=</span> <div class="color-mix-box" style="background-color: ${resultColor}"></div> <span>${resultName}</span>`;
        entryDiv.innerHTML = html;
        return entryDiv;
    }

    populateColorMixColumns(container) {
        if (!container || !this.renderer) return;
        container.innerHTML = '';

        const col1 = document.createElement('div');
        col1.className = 'color-mix-column';
        const col2 = document.createElement('div');
        col2.className = 'color-mix-column';

        const leftColumnKeys = ['BLUE,RED', 'BLUE,YELLOW', 'RED,YELLOW', 'BLUE,RED,WHITE', 'BLUE,WHITE,YELLOW', 'BLUE,RED,WHITE,YELLOW'];
        const rightColumnKeys = ['BLUE,WHITE', 'RED,WHITE', 'WHITE,YELLOW', 'BLUE,RED,YELLOW', 'RED,WHITE,YELLOW'];

        leftColumnKeys.forEach(key => col1.appendChild(this.createColorMixEntry(key)));
        rightColumnKeys.forEach(key => col2.appendChild(this.createColorMixEntry(key)));

        container.appendChild(col1);
        container.appendChild(col2);
    }

    _populateIntroRules() {
        const alreadyPopulated = this.introRulesEl.querySelector('.rules-details');
        if (!alreadyPopulated) {
            this.introRulesEl.innerHTML = `
                <details class="rules-details" open>
                    <summary class="rules-summary">
                        <h3>How to Play</h3>
                    </summary>
                    <div class="details-content">
                        <p><strong>Goal:</strong> <span>Find the position and orientation of the hidden gems.</span></p>
                        <ul>
                            <li>
                                <span>You have two methods to gather information:</span>
                                <ul>
                                    <li><strong>Send Ray:</strong> Send a light wave from an emitter on the edge. The exiting color and position reveal which gems were hit along the path.</li>
                                    <li><strong>Query Cell:</strong> Directly query a single cell. This tells you the base color of the gem in that cell (or if it's empty), but not its shape.</li>
                                </ul>
                            </li>
                            <li>Drag gems from the toolbar onto the board. You can move and rotate them.</li>
                            <li>Clicking on a placed gem rotates it by 90°. A long press flips it (if possible).</li>
                            <li>Gems cannot overlap or be edge-to-edge.</li>
                        </ul>
                    </div>
                </details>
            `;
        }

        if (window.matchMedia('(min-width: 720px)').matches) {
            this.introRulesEl.querySelectorAll('.rules-details').forEach(d => d.setAttribute('open', ''));
        }
    }

    _renderRules(methodsEl, mixingEl) {
        if (!methodsEl.querySelector('h4')) {
            methodsEl.innerHTML = `
                <h4>Game Methods</h4>
                <ul>
                    <li><strong>Send Ray:</strong> Click an emitter on the edge to send a light wave. This gives clues about the path and colors hit.</li>
                    <li><strong>Query Cell:</strong> Switch the action mode and click a cell to learn its base color.</li>
                    <li>Drag the gems onto the board to replicate the solution.</li>
                    <li>Click on a placed gem to rotate it. A long press flips it.</li>
                    <li>Gems cannot overlap or be edge-to-edge.</li>
                </ul>
            `;
        }
        if (!mixingEl.querySelector('h4')) {
            mixingEl.innerHTML = `
                <h4>Color Mixing</h4>
                <p>A light beam is deflected by colored gems, taking on their color. If it hits multiple gems, the colors mix:</p>
                <div class="color-mix-container"></div>
            `;
        }
        this.populateColorMixColumns(mixingEl.querySelector('.color-mix-container'));
    }

    _renderRating(targetEl) {
        if (!targetEl) return;
        const level = gameState.level;
        if (!level || !RATINGS[level]) {
            targetEl.innerHTML = '';
            return;
        }

        targetEl.innerHTML = `<h5>Rating for ${LEVEL_LABELS[level]}</h5>` + this._buildRatingTableHtml(RATINGS[level]);
    }

    _buildRatingTableHtml(tiers) {
        let html = '<table class="rating-table"><tbody>';
        let lastLimit = 0;
        tiers.forEach(tier => {
            let rangeText;
            if (lastLimit === 0) rangeText = `Up to ${tier.limit} queries`;
            else if (tier.limit === Infinity) rangeText = `More than ${lastLimit} queries`;
            else rangeText = `${lastLimit + 1} - ${tier.limit} queries`;
            html += `<tr><td class="range">${rangeText}:</td><td class="rating">${tier.text}</td></tr>`;
            lastLimit = tier.limit;
        });
        html += '</tbody></table>';
        return html;
    }

    // ===== Game Sheet modals =====

    _allEmitterIds() {
        const ids = [];
        for (let i = 1; i <= gameState.gridWidth; i++) ids.push(`T${i}`);
        for (let i = 1; i <= gameState.gridWidth; i++) ids.push(`B${i}`);
        for (let i = 1; i <= gameState.gridHeight; i++) ids.push(`L${i}`);
        for (let i = 1; i <= gameState.gridHeight; i++) ids.push(`R${i}`);
        return ids;
    }

    _buildColorPickGrid(container, options) {
        container.innerHTML = '';
        const includeAbsorbed = options && options.includeAbsorbed;
        const cells = [];
        const addCell = (key, label, hex, isEmpty) => {
            const cell = document.createElement('div');
            cell.className = 'color-pick';
            cell.dataset.colorKey = key;
            const swatch = document.createElement('div');
            swatch.className = 'color-pick-swatch' + (isEmpty ? ' empty' : '');
            if (!isEmpty && hex) swatch.style.backgroundColor = hex;
            const text = document.createElement('span');
            text.textContent = label;
            cell.appendChild(swatch);
            cell.appendChild(text);
            cell.addEventListener('click', () => {
                cells.forEach(c => c.classList.remove('selected'));
                cell.classList.add('selected');
                container.dataset.selectedKey = key;
            });
            container.appendChild(cell);
            cells.push(cell);
        };

        addCell('__none__', 'No color', null, true);
        Object.entries(COLOR_COMBO_NAMES).forEach(([key, name]) => {
            if (key === 'TRANSPARENT' || key === 'BLACK') return;
            const hex = COLOR_MIXING[key];
            if (!hex) return;
            addCell(key, name, hex, false);
        });
        if (includeAbsorbed) {
            addCell('__absorbed__', 'Absorbed (black)', COLORS.ABSORBED, false);
        }
        delete container.dataset.selectedKey;
    }

    _selectColorByKey(container, key) {
        if (!key) return;
        const cell = container.querySelector(`.color-pick[data-color-key="${CSS.escape(key)}"]`);
        if (cell) {
            container.querySelectorAll('.color-pick.selected').forEach(c => c.classList.remove('selected'));
            cell.classList.add('selected');
            container.dataset.selectedKey = key;
        }
    }

    _waveResultToColorKey(result) {
        if (!result) return null;
        if (result.absorbed) return '__absorbed__';
        if (!result.colors || result.colors.length === 0) return '__none__';
        return colorComboKey(result.colors);
    }

    _queryResultToColorKey(result) {
        if (!result || !result.colorName) return '__none__';
        // Match by name to one of COLOR_COMBO_NAMES values, or special cases.
        if (result.colorName === BASE_COLORS.BLACK.name) return '__absorbed__';
        const entry = Object.entries(COLOR_COMBO_NAMES).find(([, name]) => name === result.colorName);
        return entry ? entry[0] : '__none__';
    }

    openRayResultModal(emitterId, existingEntry) {
        this._rayModalContext = { emitterId, existingEntry: existingEntry || null };
        this.rayResultTitle.textContent = existingEntry
            ? `Edit ray ${emitterDisplayLabel(emitterId)}`
            : `Send Ray from ${emitterDisplayLabel(emitterId)}`;

        this._buildRayExitButtons(emitterId, existingEntry);
        this._buildColorPickGrid(this.rayColorGrid, { includeAbsorbed: true });

        if (existingEntry && existingEntry.result) {
            this._selectColorByKey(this.rayColorGrid, this._waveResultToColorKey(existingEntry.result));
        }

        this.btnRayDelete.hidden = !existingEntry;
        this.rayResultModal.classList.remove('hidden');
    }

    _buildRayExitButtons(entryEmitterId, existingEntry) {
        const container = this.rayExitButtons;
        container.innerHTML = '';
        delete container.dataset.selectedExit;

        const used = new Set(
            this.renderer.emitters.filter(e => e.isUsed).map(e => e.id)
        );
        // When editing, the existing entry's own entry+exit are "used" by it
        // but should still be selectable for this same ray.
        used.delete(entryEmitterId);
        if (existingEntry && existingEntry.result && existingEntry.result.exitId) {
            used.delete(existingEntry.result.exitId);
        }

        const buttons = [];
        const addBtn = (value, label, isSpecial) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'exit-emitter-btn' + (isSpecial ? ' special' : '');
            btn.dataset.exitValue = value;
            btn.textContent = label;
            btn.addEventListener('click', () => {
                buttons.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                container.dataset.selectedExit = value;
            });
            container.appendChild(btn);
            buttons.push(btn);
        };

        addBtn(entryEmitterId, 'Reflected back', true);
        for (const id of this._allEmitterIds()) {
            if (id === entryEmitterId) continue;
            if (used.has(id)) continue;
            addBtn(id, emitterDisplayLabel(id), false);
        }

        // Default selection: when editing, the entry's own exit (if not absorbed).
        // When creating, default to "Reflected back" so saving with no explicit
        // exit choice still produces a valid entry.
        let defaultValue = entryEmitterId;
        if (existingEntry && existingEntry.result && !existingEntry.result.absorbed && existingEntry.result.exitId) {
            defaultValue = existingEntry.result.exitId;
        }
        const target = buttons.find(b => b.dataset.exitValue === defaultValue);
        if (target) {
            target.classList.add('selected');
            container.dataset.selectedExit = defaultValue;
        }
    }

    _closeRayModal() {
        this.rayResultModal.classList.add('hidden');
        this._rayModalContext = null;
    }

    _submitRayModal() {
        const ctx = this._rayModalContext;
        if (!ctx) return;
        const colorKey = this.rayColorGrid.dataset.selectedKey;
        if (!colorKey) { alert('Pick a color.'); return; }
        const absorbed = (colorKey === '__absorbed__');
        const colors = (colorKey === '__none__' || colorKey === '__absorbed__') ? [] : colorKey.split(',');
        const selectedExit = this.rayExitButtons.dataset.selectedExit;
        if (!absorbed && !selectedExit) { alert('Pick an exit emitter.'); return; }
        const exitId = absorbed ? ctx.emitterId : selectedExit;
        if (ctx.existingEntry) {
            this.game.updateManualLogEntry(ctx.existingEntry.id, { exitId, colors, absorbed });
        } else {
            this.game.commitManualWave(ctx.emitterId, exitId, colors, absorbed);
        }
        this._closeRayModal();
    }

    _deleteFromRayModal() {
        const ctx = this._rayModalContext;
        if (!ctx || !ctx.existingEntry) return;
        this.game.deleteLogEntry(ctx.existingEntry.id);
        this._closeRayModal();
    }

    openQueryResultModal(x, y, existingEntry) {
        this._queryModalContext = { x, y, existingEntry: existingEntry || null };
        this.queryResultTitle.textContent = existingEntry
            ? `Edit query (${x + 1},${y + 1})`
            : `Query at (${x + 1},${y + 1})`;

        this._buildColorPickGrid(this.queryColorGrid, { includeAbsorbed: true });

        if (existingEntry && existingEntry.result) {
            this._selectColorByKey(this.queryColorGrid, this._queryResultToColorKey(existingEntry.result));
        }

        this.btnQueryDelete.hidden = !existingEntry;
        this.queryResultModal.classList.remove('hidden');
    }

    _closeQueryModal() {
        this.queryResultModal.classList.add('hidden');
        this._queryModalContext = null;
    }

    _submitQueryModal() {
        const ctx = this._queryModalContext;
        if (!ctx) return;
        const colorKey = this.queryColorGrid.dataset.selectedKey;
        if (!colorKey) { alert('Pick a color.'); return; }
        let colorName, colorHex;
        if (colorKey === '__none__') {
            colorName = 'Empty';
            colorHex = null;
        } else if (colorKey === '__absorbed__') {
            colorName = BASE_COLORS.BLACK.name;
            colorHex = COLORS.BLACK_GEM;
        } else {
            colorName = COLOR_COMBO_NAMES[colorKey] || 'Mix';
            colorHex = COLOR_MIXING[colorKey] || null;
        }
        if (ctx.existingEntry) {
            this.game.updateManualLogEntry(ctx.existingEntry.id, { colorName, colorHex, x: ctx.x, y: ctx.y });
        } else {
            this.game.commitManualQuery(ctx.x, ctx.y, colorName, colorHex);
        }
        this._closeQueryModal();
    }

    _deleteFromQueryModal() {
        const ctx = this._queryModalContext;
        if (!ctx || !ctx.existingEntry) return;
        this.game.deleteLogEntry(ctx.existingEntry.id);
        this._closeQueryModal();
    }

    // ===== Add custom gem modal (Game Sheet) =====

    openAddGemModal() {
        this._addGemState = { colorKey: null, shapeKey: null };
        this._populateAddGemSelectors();
        this.addGemModal.classList.remove('hidden');
    }

    _closeAddGemModal() {
        this.addGemModal.classList.add('hidden');
        this._addGemState = null;
    }

    _populateAddGemSelectors() {
        this.addGemColorSelector.innerHTML = '';
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
                this._addGemState.colorKey = key;
                this.addGemColorSelector.querySelectorAll('.color-choice').forEach(el => el.classList.remove('selected'));
                div.classList.add('selected');
            };
            this.addGemColorSelector.appendChild(div);
        });

        this.addGemShapeSelector.innerHTML = '';
        Object.entries(CUSTOM_SHAPES).forEach(([key, value]) => {
            if (key === 'SHAPE_CUSTOM_DESIGN') return; // keep the modal simple — predefined shapes only
            const div = document.createElement('div');
            div.className = 'shape-choice';
            div.dataset.shapeKey = key;
            div.title = value.name;
            const canvas = document.createElement('canvas');
            div.appendChild(canvas);
            div.onclick = () => {
                this._addGemState.shapeKey = key;
                this.addGemShapeSelector.querySelectorAll('.shape-choice').forEach(el => el.classList.remove('selected'));
                div.classList.add('selected');
            };
            setTimeout(() => this.renderer.drawToolbarGem(canvas, Object.assign({}, value, { color: COLORS.TRANSPARENT })), 0);
            this.addGemShapeSelector.appendChild(div);
        });
    }

    _submitAddGemModal() {
        const s = this._addGemState;
        if (!s || !s.colorKey || !s.shapeKey) { alert('Pick a color and a shape.'); return; }
        this.game.addGameSheetCustomGem(s.colorKey, s.shapeKey, null);
        this._closeAddGemModal();
    }

    // ===== Play against Friends modal (join a shared board) =====

    openPlayFriendsModal() {
        this.playFriendsInput.value = '';
        this.playFriendsModal.classList.remove('hidden');
        requestAnimationFrame(() => this._autosizeTextarea(this.playFriendsInput));
    }

    _closePlayFriendsModal() {
        this.playFriendsModal.classList.add('hidden');
    }

    async _pastePlayFriendsInput() {
        const btn = this.btnPlayFriendsPaste;
        const restore = btn.textContent;
        const flash = (msg) => {
            btn.textContent = msg;
            setTimeout(() => { btn.textContent = restore; }, 1500);
        };
        let text = '';
        try {
            if (navigator.clipboard && navigator.clipboard.readText) {
                text = await navigator.clipboard.readText();
            }
        } catch (e) { /* fall through */ }
        if (!text) { flash('Empty'); return; }
        this.playFriendsInput.value = text;
        this._autosizeTextarea(this.playFriendsInput);
        flash('Pasted');
    }

    _submitPlayFriendsModal() {
        const gameId = this._extractGameIdFromPasted(this.playFriendsInput.value);
        if (!gameId) { alert('Please paste a game ID or shared URL.'); return; }
        this._closePlayFriendsModal();
        this.game.startSharedGameFromId(gameId);
    }

    // ===== Share board modal (opened from topbar) =====

    openShareBoardModal() {
        const gameId = this.game.getCurrentGameId();
        if (!gameId) { alert('This board cannot be shared.'); return; }
        const url = this.game.gameShareUrl(gameId);
        this.shareBoardUrl.value = url;
        this.shareBoardGameId.value = gameId;
        this.shareBoardModal.classList.remove('hidden');
        requestAnimationFrame(() => {
            this._autosizeTextarea(this.shareBoardUrl);
            this._autosizeTextarea(this.shareBoardGameId);
        });
    }

    _closeShareBoardModal() {
        this.shareBoardModal.classList.add('hidden');
    }

    // ===== End-screen "share this board" section =====

    updateEndShareSection() {
        if (!this.endShareSection) return;
        const gameId = this.game.getCurrentGameId();
        if (!gameId) {
            this.endShareSection.hidden = true;
            return;
        }
        const url = this.game.gameShareUrl(gameId);
        this.endShareUrl.value = url;
        this.endShareGameId.value = gameId;
        this.endShareSection.hidden = false;
        requestAnimationFrame(() => {
            this._autosizeTextarea(this.endShareUrl);
            this._autosizeTextarea(this.endShareGameId);
        });
    }

    _copyToClipboard(inputEl, btnEl) {
        const text = inputEl.value;
        const restoreHtml = btnEl ? btnEl.innerHTML : null;
        const flash = (ok) => {
            if (!btnEl) return;
            btnEl.textContent = ok ? 'Copied!' : 'Copy failed';
            setTimeout(() => { btnEl.innerHTML = restoreHtml; }, 1500);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => flash(true), () => this._copyFallback(inputEl, flash));
        } else {
            this._copyFallback(inputEl, flash);
        }
    }

    _copyFallback(inputEl, flash) {
        try {
            inputEl.focus();
            inputEl.select();
            const ok = document.execCommand && document.execCommand('copy');
            flash(!!ok);
        } catch (e) {
            flash(false);
        }
    }

    _shareViaApp(url, btnEl) {
        if (!url) return;
        if (!navigator.share) return;
        const text = 'Think you can crack this Orapa puzzle? Try to find the hidden gems:';
        const restoreHtml = btnEl ? btnEl.innerHTML : null;
        const flash = (msg) => {
            if (!btnEl) return;
            btnEl.textContent = msg;
            setTimeout(() => { btnEl.innerHTML = restoreHtml; }, 1500);
        };
        navigator.share({ title: 'Orapa Puzzle', text, url })
            .catch((err) => {
                // User-cancelled is normal — don't flash an error in that case.
                if (err && err.name === 'AbortError') return;
                flash('Share failed');
            });
    }

    _extractGameIdFromPasted(text) {
        const trimmed = (text || '').trim();
        if (!trimmed) return '';
        // Accept a full shared URL or a bare game ID.
        const m = trimmed.match(/[?&]game-id=([^&\s]+)/);
        if (m) return m[1];
        return trimmed;
    }

    _autosizeTextarea(el) {
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
    }

    _formatElapsed(ms) {
        const total = Math.max(0, Math.round((ms || 0) / 1000));
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        if (h > 0) return `${h}h ${m}m ${s}s`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    }
}
