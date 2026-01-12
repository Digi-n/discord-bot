"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commands = void 0;
const discord_js_1 = require("discord.js");
const config_1 = require("../config");
const dataLoader_1 = require("../utils/dataLoader");
const permissions_1 = require("../utils/permissions");
exports.commands = [
    {
        data: new discord_js_1.SlashCommandBuilder()
            .setName('setname')
            .setDescription('Set your RP name (Usage: Firstname Lastname)')
            .addStringOption(option => option.setName('name').setDescription('Your RP Name').setRequired(true)),
        async execute(interaction) {
            if (!interaction.guild || !interaction.channel)
                return;
            // Cast to TextChannel to check name (assuming guild text channel)
            const channel = interaction.channel;
            if (!channel || !('name' in channel) || channel.name !== config_1.CONFIG.CHANNELS.NAME_CHANGE) {
                return interaction.reply({ content: `❌ Use this command only in #${config_1.CONFIG.CHANNELS.NAME_CHANGE}`, ephemeral: true });
            }
            const name = interaction.options.getString('name', true);
            const locks = (0, dataLoader_1.loadNameLocks)();
            const uid = interaction.user.id;
            if (locks[uid]) {
                return interaction.reply({ content: "❌ You already set your RP name.", ephemeral: true });
            }
            if (name.split(' ').length < 2) {
                return interaction.reply({ content: "❌ Use: Firstname Lastname", ephemeral: true });
            }
            // Attempt to change nickname
            try {
                // Fetch member ensures we have the latest object for editing
                const member = await interaction.guild.members.fetch(interaction.user.id);
                // title case
                const formattedName = name.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                await member.setNickname(formattedName);
                locks[uid] = true;
                (0, dataLoader_1.saveNameLocks)(locks);
                await interaction.reply({ content: "✅ RP name set successfully.", ephemeral: true });
            }
            catch (error) {
                console.error(error);
                await interaction.reply({ content: "❌ Failed to change nickname (Permission error?). Locked Status saved anyway.", ephemeral: true });
            }
        }
    },
    {
        data: new discord_js_1.SlashCommandBuilder()
            .setName('resetname')
            .setDescription('Reset a user\'s name lock (Management Only)')
            .addUserOption(option => option.setName('user').setDescription('The user to reset').setRequired(true)),
        async execute(interaction) {
            if (!interaction.guild)
                return;
            const member = await interaction.guild.members.fetch(interaction.user.id);
            if (!(0, permissions_1.isManagement)(member)) {
                return interaction.reply({ content: "❌ Management only.", ephemeral: true });
            }
            const targetUser = interaction.options.getUser('user', true);
            const locks = (0, dataLoader_1.loadNameLocks)();
            const uid = targetUser.id;
            if (!locks[uid]) {
                return interaction.reply({ content: "❌ This member has no locked name.", ephemeral: true });
            }
            delete locks[uid];
            (0, dataLoader_1.saveNameLocks)(locks);
            // Attempt to reset nick
            try {
                const targetMember = await interaction.guild.members.fetch(uid);
                await targetMember.setNickname(null); // Reset to default
            }
            catch (e) {
                // Ignore if can't change nick
            }
            await interaction.reply({ content: `✅ ${targetUser} can set name again.`, ephemeral: true });
        }
    }
];
