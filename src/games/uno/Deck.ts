import { Card, CardColor, CardValue } from './Card';

export class Deck {
    private cards: Card[] = [];

    constructor() {
        this.buildDeck();
        this.shuffle();
    }

    // Create a real UNO deck (108 cards)
    private buildDeck() {
        const colors: CardColor[] = ['red', 'yellow', 'green', 'blue'];

        for (const color of colors) {
            // Number cards
            this.cards.push(new Card(color, 0));

            for (let i = 1; i <= 9; i++) {
                this.cards.push(new Card(color, i as CardValue));
                this.cards.push(new Card(color, i as CardValue));
            }

            // Action cards (2 each)
            this.cards.push(new Card(color, 'skip'));
            this.cards.push(new Card(color, 'skip'));

            this.cards.push(new Card(color, 'reverse'));
            this.cards.push(new Card(color, 'reverse'));

            this.cards.push(new Card(color, 'draw2'));
            this.cards.push(new Card(color, 'draw2'));
        }

        // Wild cards
        for (let i = 0; i < 4; i++) {
            this.cards.push(new Card('wild', 'wild'));
            this.cards.push(new Card('wild', 'wild4'));
        }
    }

    // Shuffle deck
    private shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    // Draw one card
    draw(): Card {
        if (this.cards.length === 0) {
            throw new Error('Deck is empty!');
        }
        return this.cards.pop()!;
    }

    // Remaining cards
    count(): number {
        return this.cards.length;
    }
}
