import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
} from 'discord.js';

import { startUnoGame } from '../games/uno';

export const data = new SlashCommandBuilder()
    .setName('uno')
    .setDescription('Start a UNO game');

export async function execute(interaction: ChatInputCommandInteraction) {
    await startUnoGame(interaction);
}
