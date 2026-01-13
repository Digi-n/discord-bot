import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { saveStatusConfig } from '../features/status/statusConfig';
import { renderStatusImage } from '../features/status/StatusRenderer';
import { AttachmentBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('setup-status')
    .setDescription('Set the current channel as the status dashboard channel (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const buffer = await renderStatusImage(0, [], { uno: 0, c4: 0, ttt: 0 });
    const attachment = new AttachmentBuilder(buffer, { name: 'status.png' });

    // Send initial message
    const message = await interaction.editReply({
        content: '🖥️ **SYSTEM INITIALIZED**',
        files: [attachment]
    });

    // Save config
    saveStatusConfig({
        channelId: interaction.channelId,
        messageId: message.id
    });

    await interaction.followUp({
        content: '✅ Status Dashboard initialized! It will update every minute.',
        flags: MessageFlags.Ephemeral
    });
}
