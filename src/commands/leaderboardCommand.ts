import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { saveConfig, updateLeaderboardMessage } from '../utils/leaderboard';

// The specific channel ID required by the user
const LEADERBOARD_CHANNEL_ID = '1459533249985646706';

export const data = new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Initialize the live Tic-Tac-Toe leaderboard')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    if (interaction.channelId !== LEADERBOARD_CHANNEL_ID) {
        return interaction.reply({
            content: `This command can only be used in <#${LEADERBOARD_CHANNEL_ID}>!`,
            ephemeral: true
        });
    }

    await interaction.reply({ content: 'Initializing leaderboard...', ephemeral: true });

    // Save initial config with empty message ID (wrapper will create it)
    saveConfig({
        channelId: LEADERBOARD_CHANNEL_ID,
        messageId: ''
    });

    // Trigger update immediately
    await updateLeaderboardMessage(interaction.client);

    await interaction.editReply({ content: 'Leaderboard initialized! It will update every minute.' });
}
