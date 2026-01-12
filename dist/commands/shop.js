"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commands = void 0;
exports.handleShopButton = handleShopButton;
exports.handleShopModal = handleShopModal;
const discord_js_1 = require("discord.js");
const config_1 = require("../config");
const permissions_1 = require("../utils/permissions");
// In-memory cart storage
const userCarts = {};
// --- VIEWS / BUTTONS ---
const getShopView = (userId) => {
    const row = new discord_js_1.ActionRowBuilder()
        .addComponents(new discord_js_1.ButtonBuilder().setCustomId(`cart_1_${userId}`).setLabel('🛒 Cart 1').setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId(`cart_2_${userId}`).setLabel('🛒 Cart 2').setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId(`cart_3_${userId}`).setLabel('🛒 Cart 3').setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId(`cart_4_${userId}`).setLabel('🛒 Cart 4').setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId(`cart_submit_${userId}`).setLabel('✅ Final Submit').setStyle(discord_js_1.ButtonStyle.Success));
    return [row];
};
// --- MODALS ---
const createCartModal = (cartNum, userId) => {
    const modal = new discord_js_1.ModalBuilder()
        .setCustomId(`cart_modal_${cartNum}`)
        .setTitle(`Cart ${cartNum}`);
    const items = config_1.CART_PAGES[cartNum] || [];
    // Discord modals max 5 components. CART_PAGES defined in config should adhere to this.
    // Our config has <= 5 items per page.
    items.forEach(item => {
        const input = new discord_js_1.TextInputBuilder()
            .setCustomId(`item_${item}`)
            .setLabel(item)
            .setPlaceholder("Enter quantity")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(false);
        modal.addComponents(new discord_js_1.ActionRowBuilder().addComponents(input));
    });
    return modal;
};
// --- HANDLERS ---
async function handleShopButton(interaction) {
    if (!interaction.customId.startsWith('cart_'))
        return;
    const parts = interaction.customId.split('_');
    const action = parts[1]; // '1', '2', '3', '4', 'submit'
    const ownerId = parts[2];
    if (interaction.user.id !== ownerId) {
        return interaction.reply({ content: "❌ This is not your shop session.", ephemeral: true });
    }
    if (action === 'submit') {
        const cart = userCarts[ownerId];
        if (!cart || Object.keys(cart).length === 0) {
            return interaction.reply({ content: "❌ Cart is empty.", ephemeral: true });
        }
        let total = 0;
        let text = "";
        for (const [item, qty] of Object.entries(cart)) {
            const price = config_1.SHOP_ITEMS[item];
            total += price * qty;
            text += `• **${item}** × ${qty} = ₹${(price * qty).toLocaleString()}\n`;
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle("🧾 FINAL ORDER")
            .setDescription(text)
            .setColor(0x8B0000)
            .addFields({ name: "💰 Total", value: `₹${total.toLocaleString()}`, inline: false }, { name: "👤 Buyer", value: interaction.user.toString(), inline: false });
        if (interaction.channel instanceof discord_js_1.TextChannel) {
            await interaction.channel.send({ embeds: [embed] });
        }
        await interaction.reply({ content: "✅ Order placed!", ephemeral: true });
        delete userCarts[ownerId];
    }
    else {
        const cartNum = parseInt(action);
        if (!isNaN(cartNum)) {
            await interaction.showModal(createCartModal(cartNum, ownerId));
        }
    }
}
async function handleShopModal(interaction) {
    if (!interaction.customId.startsWith('cart_modal_'))
        return;
    const cartNum = parseInt(interaction.customId.split('_')[2]);
    const items = config_1.CART_PAGES[cartNum];
    if (!userCarts[interaction.user.id]) {
        userCarts[interaction.user.id] = {};
    }
    items.forEach(item => {
        const val = interaction.fields.getTextInputValue(`item_${item}`);
        if (val) {
            const qty = parseInt(val);
            if (!isNaN(qty) && qty > 0) {
                userCarts[interaction.user.id][item] = qty;
            }
        }
    });
    await interaction.reply({ content: `✅ Cart ${cartNum} updated.`, ephemeral: true });
}
exports.commands = [
    {
        data: new discord_js_1.SlashCommandBuilder().setName('shop').setDescription('Open the black market'),
        async execute(interaction) {
            if (!interaction.guild)
                return;
            const member = await interaction.guild.members.fetch(interaction.user.id);
            if (!(0, permissions_1.hasRole)(member, config_1.CONFIG.ROLES.SYNDICATE)) {
                return interaction.reply({ content: "❌ Only Syndicate Members can use this.", ephemeral: true });
            }
            await interaction.reply({
                content: "🛒 **Black Market**\nChoose a cart:",
                components: getShopView(interaction.user.id),
                ephemeral: true
            });
        }
    }
];
