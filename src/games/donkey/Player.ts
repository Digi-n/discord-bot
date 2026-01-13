import { User } from 'discord.js';
import { Card } from './Card';

export class Player {
    id: string;
    username: string;
    hand: Card[];
    selectedCardIndex: number | null = null; // For passing phase
    finished: boolean = false; // Safe/Won

    constructor(user: User) {
        this.id = user.id;
        this.username = user.username;
        this.hand = [];
    }

    addCard(card: Card) {
        this.hand.push(card);
    }

    removeCard(index: number): Card | null {
        if (index < 0 || index >= this.hand.length) return null;
        return this.hand.splice(index, 1)[0];
    }

    // Auto-discard pairs
    // Returns number of pairs removed
    processPairs(): number {
        let pairsRemoved = 0;
        const newHand: Card[] = [];
        const rankCounts: Record<string, Card[]> = {};

        // Group by Rank
        for (const card of this.hand) {
            if (!rankCounts[card.rank]) rankCounts[card.rank] = [];
            rankCounts[card.rank].push(card);
        }

        // Keep only unpaired cards
        for (const rank in rankCounts) {
            const cards = rankCounts[rank];
            if (cards.length % 2 === 1) {
                // Keep the last one
                newHand.push(cards[0]);
            }
            // If even, all discarded
            // If odd (3), 1 kept, 2 discarded
            pairsRemoved += Math.floor(cards.length / 2);
        }

        this.hand = newHand;
        return pairsRemoved;
    }

    get handSize(): number {
        return this.hand.length;
    }
}
