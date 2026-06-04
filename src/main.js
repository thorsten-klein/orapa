'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const ui = new UI();
    const game = new Game(ui);
    window.game = game;

    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'play' && params.get('game-id')) {
        game.startSharedGameFromId(params.get('game-id'));
        // Drop the query string so navigating around doesn't re-trigger the join
        // (and so the address bar stays clean once the board is loaded).
        try {
            history.replaceState(history.state, '', window.location.pathname);
        } catch (e) { /* ignore */ }
    }
});
