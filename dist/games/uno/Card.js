"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Card = void 0;
// UNO Card class
class Card {
    color;
    value;
    constructor(color, value) {
        this.color = color;
        this.value = value;
    }
    // For debugging / display
    toString() {
        return `${this.color.toUpperCase()} ${this.value}`;
    }
}
exports.Card = Card;
