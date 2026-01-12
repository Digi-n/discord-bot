import { RANKS, SUITS } from './Constants';

export class Card {
    rank: string;
    suit: string;

    constructor(rank: string, suit: string) {
        this.rank = rank;
        this.suit = suit;
    }

    toString(): string {
        return `${this.rank}${this.suit}`;
    }

    equals(other: Card): boolean {
        return this.rank === other.rank && this.suit === other.suit;
    }
}

export class Deck {
    cards: Card[];

    constructor() {
        this.cards = [];
        this.reset();
    }

    reset() {
        this.cards = [];
        for (const suit of SUITS) {
            for (const rank of RANKS) {
                this.cards.push(new Card(rank, suit));
            }
        }
        this.shuffle();
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    deal(count: number): Card[] {
        return this.cards.splice(0, count);
    }
}
