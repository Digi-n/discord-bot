export type Suit = '♠️' | '♥️' | '♦️' | '♣️';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export class Card {
    suit: Suit;
    rank: Rank;

    constructor(suit: Suit, rank: Rank) {
        this.suit = suit;
        this.rank = rank;
    }

    toString(): string {
        return `${this.rank}${this.suit}`;
    }

    equals(other: Card): boolean {
        return this.suit === other.suit && this.rank === other.rank;
    }

    get value(): number {
        const rankValues: Record<string, number> = {
            'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
        };
        return rankValues[this.rank];
    }
}
