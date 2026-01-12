import { Card } from './Card';

export class Player {
    id: string;
    username: string;
    hand: Card[];
    saidUno: boolean = false;

    constructor(id: string, username: string) {
        this.id = id;
        this.username = username;
        this.hand = [];
    }

    addCard(card: Card) {
        this.hand.push(card);
    }

    // Returns a readable list of cards (e.g., "[RED 5] [BLUE REVERSE]")
    getHandText(): string {
        return this.hand.map(card => `[${card.toString()}]`).join(' ');
    }
}
