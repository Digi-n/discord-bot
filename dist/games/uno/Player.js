"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Player = void 0;
class Player {
    id;
    username;
    hand;
    saidUno = false;
    constructor(id, username) {
        this.id = id;
        this.username = username;
        this.hand = [];
    }
    addCard(card) {
        this.hand.push(card);
    }
    // Returns a readable list of cards (e.g., "[RED 5] [BLUE REVERSE]")
    getHandText() {
        return this.hand.map(card => `[${card.toString()}]`).join(' ');
    }
}
exports.Player = Player;
