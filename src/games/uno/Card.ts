// Types of UNO colors
export type CardColor = 'red' | 'yellow' | 'green' | 'blue' | 'wild';

// Types of UNO values
export type CardValue =
    | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
    | 'skip'
    | 'reverse'
    | 'draw2'
    | 'wild'
    | 'wild4';

// UNO Card class
export class Card {
    color: CardColor;
    value: CardValue;

    constructor(color: CardColor, value: CardValue) {
        this.color = color;
        this.value = value;
    }

    // For debugging / display
    toString(): string {
        return `${this.color.toUpperCase()} ${this.value}`;
    }
}
