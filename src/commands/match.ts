import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import * as matchGame from '../games/match/index';

export const data = new SlashCommandBuilder()
    .setName('match')
    .setDescription('Start a Matching Card Game (Rummy Style)');

export async function execute(interaction: ChatInputCommandInteraction) {
    await matchGame.execute(interaction);
}
