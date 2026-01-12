import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { startLiarsBarGame } from '../games/liarsbar';

export const data = new SlashCommandBuilder()
    .setName('liarsbar')
    .setDescription('Start a game of Liar\'s Bar');

export async function execute(interaction: ChatInputCommandInteraction) {
    await startLiarsBarGame(interaction);
}
