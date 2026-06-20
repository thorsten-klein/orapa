'use strict';

// Sorted-and-joined key for a list of base color names.
// Used as the lookup key for COLOR_MIXING and COLOR_COMBO_NAMES.
function colorComboKey(colors) {
    return [...colors].sort().join(',');
}

// rgba string for the transparent gem fill (used in canvas + DOM swatches).
function transparentFillRgba(alpha) {
    return `rgba(164, 212, 228, ${alpha})`;
}

// User-facing label for an emitter id.
// Numbers along Top+Right (clockwise from top-left), letters along Left+Bottom.
// T1..T8 → '1'..'8', R1..R10 → '9'..'18',
// L1..L10 → 'A'..'J', B1..B8 → 'K'..'R'.
function emitterDisplayLabel(emitterId) {
    if (!emitterId) return emitterId;
    const prefix = emitterId[0];
    const num = parseInt(emitterId.substring(1));
    if (isNaN(num)) return emitterId; // non-emitter ids like 'Absorbed', 'Loop?'
    const w = (typeof gameState !== 'undefined' && gameState.gridWidth) || GRID_WIDTH;
    const h = (typeof gameState !== 'undefined' && gameState.gridHeight) || GRID_HEIGHT;
    switch (prefix) {
        case 'T': return String(num);
        case 'R': return String(w + num);
        case 'L': return String.fromCharCode(65 + num - 1);
        case 'B': return String.fromCharCode(65 + h + num - 1);
        default:  return emitterId;
    }
}

const LEVELS = {
    TRAINING: 'TRAINING',
    NORMAL: 'NORMAL',
    MEDIUM: 'MEDIUM',
    MEDIUM_PLUS: 'MEDIUM_PLUS',
    HARD: 'HARD',
    EXPERIENCED: 'EXPERIENCED',
    EXTREME: 'EXTREME',
    CUSTOM: 'CUSTOM',
    GAME_SHEET: 'GAME_SHEET',
    BOARD_CREATION: 'BOARD_CREATION',
};

const COLORS = {
    YELLOW: '#ffe600',
    RED: '#ff1f2e',
    BLUE: '#1e7fff',
    WHITE: '#ecf0f1',
    TRANSPARENT: '#95a5a6',
    PURPLE: '#9b59b6',           // red + blue
    SKY_BLUE: '#5dade2',         // white + blue
    GREEN: '#2ecc71',            // yellow + blue
    PINK: '#ff8a80',             // white + red (light red)
    ORANGE: '#e67e22',           // yellow + red
    LEMON: '#ffff8d',            // white + yellow (light yellow)
    LIGHT_PURPLE: '#ba68c8',     // red + blue + white
    BLACK_GEM: '#1d1d1d',
    BLACK_MIX: '#34495e',        // blue + yellow + red
    LIGHT_GREEN: '#81c784',      // white + yellow + blue
    LIGHT_ORANGE: '#ffb74d',     // white + yellow + red
    GRAY: '#9e9e9e',             // all 4
    ABSORBED: '#17202a',
    CORRECT: '#4caf50',
    INVALID_GEM: '#e74c3c',
};

const BASE_COLORS = {
    RED:          { name: 'Red',          color: COLORS.RED,        baseGems: ['RED'] },
    YELLOW:       { name: 'Yellow',       color: COLORS.YELLOW,     baseGems: ['YELLOW'] },
    BLUE:         { name: 'Blue',         color: COLORS.BLUE,       baseGems: ['BLUE'] },
    WHITE:        { name: 'White',        color: COLORS.WHITE,      baseGems: ['WHITE'] },
    TRANSPARENT:  { name: 'Transparent',  color: COLORS.TRANSPARENT, baseGems: [] },
    BLACK:        { name: 'Black',        color: COLORS.BLACK_GEM,  baseGems: [], special: 'absorbs' },
    LIGHT_RED:    { name: 'Light Red',    color: COLORS.PINK,       baseGems: ['RED', 'WHITE'] },
    LIGHT_YELLOW: { name: 'Light Yellow', color: COLORS.LEMON,      baseGems: ['WHITE', 'YELLOW'] },
    LIGHT_BLUE:   { name: 'Light Blue',   color: COLORS.SKY_BLUE,   baseGems: ['BLUE', 'WHITE'] },
};

// Keys are the sorted, comma-joined baseGems of light hitting the gem(s).
// Sort order changed from German to English alphabetical (BLUE < GREEN < RED < WHITE < YELLOW).
const COLOR_MIXING = {
    'BLUE': COLORS.BLUE,
    'YELLOW': COLORS.YELLOW,
    'RED': COLORS.RED,
    'WHITE': COLORS.WHITE,
    'BLUE,RED': COLORS.PURPLE,
    'BLUE,WHITE': COLORS.SKY_BLUE,
    'BLUE,YELLOW': COLORS.GREEN,
    'RED,WHITE': COLORS.PINK,
    'RED,YELLOW': COLORS.ORANGE,
    'WHITE,YELLOW': COLORS.LEMON,
    'BLUE,RED,WHITE': COLORS.LIGHT_PURPLE,
    'BLUE,RED,YELLOW': COLORS.BLACK_MIX,
    'BLUE,WHITE,YELLOW': COLORS.LIGHT_GREEN,
    'RED,WHITE,YELLOW': COLORS.LIGHT_ORANGE,
    'BLUE,RED,WHITE,YELLOW': COLORS.GRAY,
};

// Display names for individual gems and gem-combinations.
// Keys are the sorted, comma-joined baseGems of light hitting the gem(s).
const COLOR_COMBO_NAMES = {
    'BLUE':                  'Blue',
    'YELLOW':                'Yellow',
    'RED':                   'Red',
    'WHITE':                 'White',
    'TRANSPARENT':           'Transparent',
    'BLACK':                 'Black',
    'BLUE,RED':              'Purple',
    'BLUE,WHITE':            'Light Blue',
    'BLUE,YELLOW':           'Green',
    'RED,WHITE':             'Light Red',
    'RED,YELLOW':            'Orange',
    'WHITE,YELLOW':          'Light Yellow',
    'BLUE,RED,WHITE':        'Light Purple',
    'BLUE,RED,YELLOW':       'Dark Gray',
    'BLUE,WHITE,YELLOW':     'Light Green',
    'RED,WHITE,YELLOW':      'Light Orange',
    'BLUE,RED,WHITE,YELLOW': 'Gray',
};

const LEVEL_LABELS = {
    [LEVELS.TRAINING]: 'Training',
    [LEVELS.NORMAL]:   'Normal',
    [LEVELS.MEDIUM]:   'Medium',
    [LEVELS.MEDIUM_PLUS]: 'Medium +',
    [LEVELS.HARD]:     'Hard',
    [LEVELS.EXPERIENCED]: 'Experienced',
    [LEVELS.EXTREME]:  'Extreme',
    [LEVELS.CUSTOM]:   'Play a Custom Level',
    [LEVELS.GAME_SHEET]: 'Use as Game Sheet',
    [LEVELS.BOARD_CREATION]: 'Create a Board',
};

const LEVEL_DESCRIPTIONS = {
    [LEVELS.TRAINING]: 'Ideal for learning the game, shows the path of light rays.',
    [LEVELS.NORMAL]:   'The basics. Get to know the colored and white gems.',
    [LEVELS.MEDIUM]:   'A new challenge. A transparent prism gem deflects light without coloring it.',
    [LEVELS.MEDIUM_PLUS]: 'Same as Medium, but with a black, light-absorbing gem instead of the transparent prism.',
    [LEVELS.HARD]:     'Expert mode. In addition to the transparent gem, a black, light-absorbing gem comes into play.',
    [LEVELS.EXPERIENCED]: 'All Hard-mode gems plus a light-blue block that tints any ray passing through it.',
    [LEVELS.EXTREME]:  'Master mode. Same as Hard, but the gem shapes are hidden — you must draw the cells yourself.',
    [LEVELS.CUSTOM]:   'Choose your own gems and create a new challenge.',
    [LEVELS.GAME_SHEET]: 'Digital Score sheet for the physical board game — use the logbook and digital visualization.',
    [LEVELS.BOARD_CREATION]: 'Design your own board by placing gems exactly where you want them, then share it.',
};

const GEMS = {
    YELLOW: {
        name: 'YELLOW', color: COLORS.YELLOW, baseGems: ['YELLOW'],
        gridPattern: [
            [CellState.TRIANGLE_BL, CellState.EMPTY],
            [CellState.BLOCK, CellState.TRIANGLE_BL],
        ],
    },
    RED: {
        name: 'RED', color: COLORS.RED, baseGems: ['RED'],
        gridPattern: [
            [CellState.TRIANGLE_BR, CellState.BLOCK, CellState.TRIANGLE_TL],
        ],
    },
    BLUE: {
        name: 'BLUE', color: COLORS.BLUE, baseGems: ['BLUE'],
        gridPattern: [
            [CellState.EMPTY, CellState.TRIANGLE_BR, CellState.TRIANGLE_BL, CellState.EMPTY],
            [CellState.TRIANGLE_BR, CellState.BLOCK, CellState.BLOCK, CellState.TRIANGLE_BL],
        ],
    },
    WHITE_DIAMOND: {
        name: 'WHITE_DIAMOND', color: COLORS.WHITE, baseGems: ['WHITE'],
        gridPattern: [
            [CellState.TRIANGLE_BR, CellState.TRIANGLE_BL],
            [CellState.TRIANGLE_TR, CellState.TRIANGLE_TL],
        ],
    },
    WHITE_TRIANGLE: {
        name: 'WHITE_TRIANGLE', color: COLORS.WHITE, baseGems: ['WHITE'],
        gridPattern: [
            [CellState.EMPTY, CellState.TRIANGLE_BR, CellState.TRIANGLE_BL, CellState.EMPTY],
            [CellState.TRIANGLE_BR, CellState.BLOCK, CellState.BLOCK, CellState.TRIANGLE_BL],
        ],
    },
    TRANSPARENT: {
        name: 'TRANSPARENT', color: COLORS.TRANSPARENT, baseGems: [],
        gridPattern: [
            [CellState.TRIANGLE_BR, CellState.TRIANGLE_BL],
        ],
    },
    BLACK: {
        name: 'BLACK', color: COLORS.BLACK_GEM, baseGems: [], special: 'absorbs',
        // Same footprint as SHAPE_SMALL_TRIANGLE — two corner-triangles forming a
        // small "tent". The reflecting cell shapes are overridden by the gem-level
        // `special: 'absorbs'` flag, which the path-tracer honors below.
        gridPattern: [[CellState.TRIANGLE_BR, CellState.TRIANGLE_BL]],
    },
    LIGHT_BLUE_BLOCK: {
        name: 'LIGHT_BLUE_BLOCK', color: COLORS.SKY_BLUE, baseGems: ['BLUE', 'WHITE'],
        gridPattern: [[CellState.BLOCK, CellState.BLOCK]],
    },
};

const CUSTOM_SHAPES = {
    SHAPE_RTRIANGLE:      { name: 'Right Triangle',     gridPattern: GEMS.YELLOW.gridPattern },
    SHAPE_PARALLEL:       { name: 'Parallelogram',      gridPattern: GEMS.RED.gridPattern },
    SHAPE_BIG_TRIANGLE:   { name: 'Large Triangle',     gridPattern: GEMS.BLUE.gridPattern },
    SHAPE_DIAMOND:        { name: 'Diamond',            gridPattern: GEMS.WHITE_DIAMOND.gridPattern },
    SHAPE_SMALL_TRIANGLE: { name: 'Small Triangle',     gridPattern: GEMS.TRANSPARENT.gridPattern },
    SHAPE_BLOCK:          { name: 'Block',              gridPattern: GEMS.LIGHT_BLUE_BLOCK.gridPattern },
    SHAPE_L:              { name: 'L-Shape',            gridPattern: [[CellState.TRIANGLE_BR, CellState.TRIANGLE_BL], [CellState.BLOCK, CellState.TRIANGLE_TL]] },
    SHAPE_T:              { name: 'T-Shape',            gridPattern: [[CellState.TRIANGLE_BR, CellState.BLOCK, CellState.TRIANGLE_BL], [CellState.TRIANGLE_TR, CellState.BLOCK, CellState.TRIANGLE_TL]] },
    SHAPE_SQUARE:         { name: 'Square',             gridPattern: [[CellState.TRIANGLE_BR, CellState.BLOCK], [CellState.BLOCK, CellState.TRIANGLE_TL]] },
    SHAPE_BAR:            { name: 'Bar',                gridPattern: [[CellState.TRIANGLE_BL], [CellState.BLOCK], [CellState.TRIANGLE_TL]] },
    SHAPE_SMALL:          { name: 'Small',              gridPattern: [[CellState.TRIANGLE_TR, CellState.TRIANGLE_BL]] },
    SHAPE_TRIANGLE_BIG:   { name: 'Wide Triangle',      gridPattern: [[CellState.TRIANGLE_TR, CellState.BLOCK, CellState.TRIANGLE_BL]] },
    SHAPE_Z:              { name: 'Z-Shape',            gridPattern: [[CellState.TRIANGLE_BR, CellState.BLOCK, CellState.EMPTY], [CellState.EMPTY, CellState.BLOCK, CellState.TRIANGLE_TL]] },
    SHAPE_PLUS:           { name: 'Plus',               gridPattern: [[CellState.EMPTY, CellState.BLOCK, CellState.EMPTY], [CellState.BLOCK, CellState.BLOCK, CellState.BLOCK], [CellState.EMPTY, CellState.BLOCK, CellState.EMPTY]] },
    SHAPE_PENT_HOUSE:     { name: 'House',              gridPattern: [[CellState.EMPTY, CellState.TRIANGLE_BR, CellState.TRIANGLE_BL, CellState.EMPTY], [CellState.TRIANGLE_TR, CellState.BLOCK, CellState.BLOCK, CellState.TRIANGLE_TL]] },
    SHAPE_LONG_PARALLEL:  { name: 'Long Parallelogram', gridPattern: [[CellState.TRIANGLE_BR, CellState.BLOCK, CellState.BLOCK, CellState.TRIANGLE_TL]] },
    SHAPE_ARROW:          { name: 'Arrow',              gridPattern: [
        [CellState.TRIANGLE_BR, CellState.TRIANGLE_BL],
        [CellState.TRIANGLE_TL, CellState.TRIANGLE_TR],
    ] },
    SHAPE_CUSTOM_DESIGN:  { name: 'Custom Shape',       gridPattern: [[CellState.EMPTY, CellState.BLOCK, CellState.EMPTY], [CellState.BLOCK, CellState.BLOCK, CellState.BLOCK], [CellState.EMPTY, CellState.BLOCK, CellState.EMPTY]] },
};

const GEM_SETS = {
    [LEVELS.TRAINING]: ['YELLOW', 'RED', 'BLUE', 'WHITE_DIAMOND', 'WHITE_TRIANGLE'],
    [LEVELS.NORMAL]: ['YELLOW', 'RED', 'BLUE', 'WHITE_DIAMOND', 'WHITE_TRIANGLE'],
    [LEVELS.MEDIUM]: ['YELLOW', 'RED', 'BLUE', 'WHITE_DIAMOND', 'WHITE_TRIANGLE', 'TRANSPARENT'],
    [LEVELS.MEDIUM_PLUS]: ['YELLOW', 'RED', 'BLUE', 'WHITE_DIAMOND', 'WHITE_TRIANGLE', 'BLACK'],
    [LEVELS.HARD]: ['YELLOW', 'RED', 'BLUE', 'WHITE_DIAMOND', 'WHITE_TRIANGLE', 'TRANSPARENT', 'BLACK'],
    [LEVELS.EXPERIENCED]: ['YELLOW', 'RED', 'BLUE', 'WHITE_DIAMOND', 'WHITE_TRIANGLE', 'TRANSPARENT', 'BLACK', 'LIGHT_BLUE_BLOCK'],
    [LEVELS.EXTREME]: ['YELLOW', 'RED', 'BLUE', 'WHITE_DIAMOND', 'WHITE_TRIANGLE', 'TRANSPARENT', 'BLACK'],
    [LEVELS.GAME_SHEET]: ['YELLOW', 'RED', 'BLUE', 'WHITE_DIAMOND', 'WHITE_TRIANGLE', 'TRANSPARENT', 'BLACK'],
};

const RATING_TEXTS = {
    training: ['Very good', 'Good', 'Average', 'Needs improvement'],
    normal:   [
        "A true gem-finding expert",
        "A pro who can't be fooled",
        'Good gem hunter',
        'Yay, all gems found!',
        'At least all gems were found.',
    ],
    medium:   [
        'Masterful! Hardly a query wasted.',
        'Very impressive! You know your stuff.',
        "Strong performance! You've got the hang of it.",
        'Well done! All treasures recovered.',
        'Patience and persistence lead to success!',
    ],
    hard:     [
        'Legendary! A performance for the history books.',
        'Outstanding! Even experts are amazed.',
        "Expert level! You've really got it.",
        'A tough job, but successful!',
        'Phew, that was close, but you won!',
    ],
};

const RATINGS = {
    [LEVELS.TRAINING]: [
        { limit: 8,        text: RATING_TEXTS.training[0] },
        { limit: 10,       text: RATING_TEXTS.training[1] },
        { limit: 20,       text: RATING_TEXTS.training[2] },
        { limit: Infinity, text: RATING_TEXTS.training[3] },
    ],
    [LEVELS.NORMAL]: [
        { limit: 10,       text: RATING_TEXTS.normal[0] },
        { limit: 13,       text: RATING_TEXTS.normal[1] },
        { limit: 18,       text: RATING_TEXTS.normal[2] },
        { limit: 23,       text: RATING_TEXTS.normal[3] },
        { limit: Infinity, text: RATING_TEXTS.normal[4] },
    ],
    [LEVELS.MEDIUM]: [
        { limit: 12,       text: RATING_TEXTS.medium[0] },
        { limit: 15,       text: RATING_TEXTS.medium[1] },
        { limit: 20,       text: RATING_TEXTS.medium[2] },
        { limit: 25,       text: RATING_TEXTS.medium[3] },
        { limit: Infinity, text: RATING_TEXTS.medium[4] },
    ],
    [LEVELS.MEDIUM_PLUS]: [
        { limit: 12,       text: RATING_TEXTS.medium[0] },
        { limit: 15,       text: RATING_TEXTS.medium[1] },
        { limit: 20,       text: RATING_TEXTS.medium[2] },
        { limit: 25,       text: RATING_TEXTS.medium[3] },
        { limit: Infinity, text: RATING_TEXTS.medium[4] },
    ],
    [LEVELS.HARD]: [
        { limit: 15,       text: RATING_TEXTS.hard[0] },
        { limit: 18,       text: RATING_TEXTS.hard[1] },
        { limit: 21,       text: RATING_TEXTS.hard[2] },
        { limit: 25,       text: RATING_TEXTS.hard[3] },
        { limit: Infinity, text: RATING_TEXTS.hard[4] },
    ],
    [LEVELS.EXPERIENCED]: [
        { limit: 16,       text: RATING_TEXTS.hard[0] },
        { limit: 20,       text: RATING_TEXTS.hard[1] },
        { limit: 24,       text: RATING_TEXTS.hard[2] },
        { limit: 30,       text: RATING_TEXTS.hard[3] },
        { limit: Infinity, text: RATING_TEXTS.hard[4] },
    ],
    [LEVELS.EXTREME]: [
        { limit: 18,       text: RATING_TEXTS.hard[0] },
        { limit: 22,       text: RATING_TEXTS.hard[1] },
        { limit: 28,       text: RATING_TEXTS.hard[2] },
        { limit: 35,       text: RATING_TEXTS.hard[3] },
        { limit: Infinity, text: RATING_TEXTS.hard[4] },
    ],
    [LEVELS.CUSTOM]: [
        { limit: 15,       text: RATING_TEXTS.hard[0] },
        { limit: 18,       text: RATING_TEXTS.hard[1] },
        { limit: 21,       text: RATING_TEXTS.hard[2] },
        { limit: 25,       text: RATING_TEXTS.hard[3] },
        { limit: Infinity, text: RATING_TEXTS.hard[4] },
    ],
};
