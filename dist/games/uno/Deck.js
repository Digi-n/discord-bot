"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Deck = void 0;
const Card_1 = require("./Card");
class Deck {
    cards = [];
    constructor() {
        this.buildDeck();
        this.shuffle();
    }
    // Create a real UNO deck (108 cards)
    buildDeck() {
        const colors = ['red', 'yellow', 'green', 'blue'];
        for (const color of colors) {
            // Number cards
            this.cards.push(new Card_1.Card(color, 0));
            for (let i = 1; i <= 9; i++) {
                this.cards.push(new Card_1.Card(color, i));
                this.cards.push(new Card_1.Card(color, i));
            }
            // Action cards (2 each)
            this.cards.push(new Card_1.Card(color, 'skip'));
            this.cards.push(new Card_1.Card(color, 'skip'));
            this.cards.push(new Card_1.Card(color, 'reverse'));
            this.cards.push(new Card_1.Card(color, 'reverse'));
            this.cards.push(new Card_1.Card(color, 'draw2'));
            this.cards.push(new Card_1.Card(color, 'draw2'));
        }
        // Wild cards
        for (let i = 0; i < 4; i++) {
            this.cards.push(new Card_1.Card('wild', 'wild'));
            this.cards.push(new Card_1.Card('wild', 'wild4'));
        }
    }
    // Shuffle deck
    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }
    // Draw one card
    draw() {
        if (this.cards.length === 0) {
            throw new Error('Deck is empty!');
        }
        return this.cards.pop();
    }
    // Remaining cards
    count() {
        return this.cards.length;
    }
}
exports.Deck = Deck;
