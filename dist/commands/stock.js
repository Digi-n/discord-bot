"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commands = exports.createStockModal = void 0;
exports.handleStockButton = handleStockButton;
exports.handleStockModal = handleStockModal;
const discord_js_1 = require("discord.js");
const dataLoader_1 = require("../utils/dataLoader");
const permissions_1 = require("../utils/permissions");
// --- BUTTONS ---
const weedButton = new discord_js_1.ButtonBuilder()
    .setCustomId('weed_update')
    .setLabel('Update Weed Stock')
    .setStyle(discord_js_1.ButtonStyle.Success);
const methButton = new discord_js_1.ButtonBuilder()
    .setCustomId('meth_update')
    .setLabel('Update Meth Stock')
    .setStyle(discord_js_1.ButtonStyle.Primary); // Blurple is Primary
const distButton = new discord_js_1.ButtonBuilder()
    .setCustomId('dist_update')
    .setLabel('Log Distribution')
    .setStyle(discord_js_1.ButtonStyle.Danger);
// --- MODALS ---
const createStockModal = (stockType, title) => {
    const modal = new discord_js_1.ModalBuilder()
        .setCustomId(`stock_modal_${stockType}`)
        .setTitle(title);
    const amountInput = new discord_js_1.TextInputBuilder()
        .setCustomId('amount')
        .setLabel('Enter amount')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setRequired(true);
    const row = new discord_js_1.ActionRowBuilder().addComponents(amountInput);
    modal.addComponents(row);
    return modal;
};
exports.createStockModal = createStockModal;
// --- HANDLERS ---
async function handleStockButton(interaction) {
    if (!interaction.isButton())
        return;
    let modal;
    if (interaction.customId === 'weed_update') {
        modal = (0, exports.createStockModal)('weed', 'Update Weed Stock');
    }
    else if (interaction.customId === 'meth_update') {
        modal = (0, exports.createStockModal)('meth', 'Update Meth Stock');
    }
    else if (interaction.customId === 'dist_update') {
        modal = (0, exports.createStockModal)('distribution', 'Log Distribution');
    }
    if (modal) {
        await interaction.showModal(modal);
    }
}
async function handleStockModal(interaction) {
    if (!interaction.customId.startsWith('stock_modal_'))
        return;
    if (!interaction.guild)
        return;
    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (!(0, permissions_1.canUpdateStock)(member)) {
        return interaction.reply({ content: "❌ Only Management, Grower, Distributor or Cook can update stock.", ephemeral: true });
    }
    const stockType = interaction.customId.replace('stock_modal_', '');
    const amountStr = interaction.fields.getTextInputValue('amount');
    const amount = parseInt(amountStr);
    if (isNaN(amount) || amount < 0) {
        return interaction.reply({ content: "❌ Invalid number", ephemeral: true });
    }
    const data = (0, dataLoader_1.loadStockData)();
    let text = "";
    if (stockType === 'weed') {
        data.weed = amount;
        text = `🌿 **WEED STOCK**\n\nCurrent Stock: **${data.weed} g**`;
    }
    else if (stockType === 'meth') {
        data.meth = amount;
        text = `🧪 **METH STOCK**\n\nCurrent Stock: **${data.meth} g**`;
    }
    else if (stockType === 'distribution') {
        data.distribution += amount;
        text = `🚚 **DISTRIBUTION LOG**\n\nTotal Distributed: **${data.distribution} g**`;
    }
    (0, dataLoader_1.saveStockData)(data);
    // Edit the message that the button is attached to
    try {
        await interaction.message?.edit({ content: text });
        await interaction.reply({ content: "✅ Stock updated", ephemeral: true });
    }
    catch (e) {
        await interaction.reply({ content: "✅ Stock updated (Message update failed)", ephemeral: true });
    }
}
exports.commands = [
    {
        data: new discord_js_1.SlashCommandBuilder().setName('setup_weed').setDescription('Setup weed stock panel'),
        async execute(interaction) {
            if (!interaction.guild)
                return;
            const member = await interaction.guild.members.fetch(interaction.user.id);
            if (!(0, permissions_1.isManagement)(member))
                return interaction.reply({ content: "❌ Management only.", ephemeral: true });
            const data = (0, dataLoader_1.loadStockData)();
            const row = new discord_js_1.ActionRowBuilder().addComponents(weedButton);
            if (interaction.channel instanceof discord_js_1.TextChannel) {
                await interaction.channel.send({
                    content: `🌿 **WEED STOCK**\n\nCurrent Stock: **${data.weed} g**`,
                    components: [row]
                });
            }
            await interaction.reply({ content: "✅ Weed panel created", ephemeral: true });
        }
    },
    {
        data: new discord_js_1.SlashCommandBuilder().setName('setup_meth').setDescription('Setup meth stock panel'),
        async execute(interaction) {
            if (!interaction.guild)
                return;
            const member = await interaction.guild.members.fetch(interaction.user.id);
            if (!(0, permissions_1.isManagement)(member))
                return interaction.reply({ content: "❌ Management only.", ephemeral: true });
            const data = (0, dataLoader_1.loadStockData)();
            const row = new discord_js_1.ActionRowBuilder().addComponents(methButton);
            if (interaction.channel instanceof discord_js_1.TextChannel) {
                await interaction.channel.send({
                    content: `🧪 **METH STOCK**\n\nCurrent Stock: **${data.meth} g**`,
                    components: [row]
                });
            }
            await interaction.reply({ content: "✅ Meth panel created", ephemeral: true });
        }
    },
    {
        data: new discord_js_1.SlashCommandBuilder().setName('setup_distribution').setDescription('Setup distribution log'),
        async execute(interaction) {
            if (!interaction.guild)
                return;
            const member = await interaction.guild.members.fetch(interaction.user.id);
            if (!(0, permissions_1.isManagement)(member))
                return interaction.reply({ content: "❌ Management only.", ephemeral: true });
            const data = (0, dataLoader_1.loadStockData)();
            const row = new discord_js_1.ActionRowBuilder().addComponents(distButton);
            if (interaction.channel instanceof discord_js_1.TextChannel) {
                await interaction.channel.send({
                    content: `🚚 **DISTRIBUTION LOG**\n\nTotal Distributed: **${data.distribution} g**`,
                    components: [row]
                });
            }
            await interaction.reply({ content: "✅ Distribution panel created", ephemeral: true });
        }
    }
];
