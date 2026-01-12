import { Card } from './Card';
import { LIVES_COUNT } from './Constants';
import { User } from 'discord.js';

export class Player {
    id: string;
    username: string;
    hand: Card[];
    lives: number;
    active: boolean;

    constructor(user: User) {
        this.id = user.id;
        this.username = user.username;
        this.hand = [];
        this.lives = LIVES_COUNT;
        this.active = true;
    }

    removeCards(cardsToRemove: Card[]) {
        this.hand = this.hand.filter(card =>
            !cardsToRemove.some(r => r.equals(card))
        );
    }

    // Sort hand by Rank
    sortHand() {
        // Basic sort, can be improved
        this.hand.sort((a, b) => a.rank.localeCompare(b.rank));
    }
}
