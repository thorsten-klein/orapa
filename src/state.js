'use strict';

const GameStatus = {
    MAIN_MENU: 0,
    LEVEL_SELECT: 1,
    CUSTOM_CREATOR: 2,
    PLAYING: 3,
    GAME_OVER: 4,
};

const InteractionMode = {
    WAVE: 'wave',
    QUERY: 'query',
};

const gameState = {
    status: GameStatus.MAIN_MENU,
    level: null,
    gridWidth: GRID_WIDTH,
    gridHeight: GRID_HEIGHT,
    interactionMode: InteractionMode.WAVE,
    secretGems: [],
    playerGems: [],
    log: [],
    waveCount: 0,
    elapsedMs: 0,
    debugMode: false,
    showReflectionPath: true,
    showPlayerPathPreview: false,
    activePlayerPath: null,
    activePlayerResult: null,
    selectedLogEntryId: null,
    previewSourceEmitterId: null,
    permanentQueryResults: [],
    blockedCells: [],
    customGemSet: [],
    customGemDefinitions: {},
    drawSelectedColor: null,
    revealedMode: false,
};
