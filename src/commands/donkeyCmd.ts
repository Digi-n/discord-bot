import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import * as donkeyGame from '../games/donkey/index';

export const data = new SlashCommandBuilder()
    .setName('donkey')
    .setDescription('Start a Kazhutha (Donkey) Trick-Taking Game');

export async function execute(interaction: ChatInputCommandInteraction) {
    await donkeyGame.execute(interaction);
}
