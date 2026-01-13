export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUITS = ['♠️', '♥️', '♦️', '♣️'];


export const MAX_PLAYERS = 6;
export const BLUFF_WINDOW_MS = 10000; // 10 seconds to call Liar
export const TURN_TIMEOUT_MS = 60000; // 60 seconds to play

export enum GameState {
    LOBBY,
    PLAYING_TURN,
    BLUFF_PHASE,
    REVEAL,
    GAME_OVER
}
