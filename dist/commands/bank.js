"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commands = void 0;
const discord_js_1 = require("discord.js");
const config_1 = require("../config");
const dataLoader_1 = require("../utils/dataLoader");
const permissions_1 = require("../utils/permissions");
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
async function publicAnimation(channel) {
    const msg = await channel.send("💳 **Processing transaction**");
    await sleep(1000);
    await msg.edit("🔐 Verifying source");
    await sleep(1000);
    await msg.edit("🧾 Updating ledger");
    await sleep(1000);
    await msg.edit("✅ Transaction Approved");
}
exports.commands = [
    {
        data: new discord_js_1.SlashCommandBuilder()
            .setName('deposit')
            .setDescription('Deposit black money')
            .addIntegerOption(option => option.setName('amount').setDescription('Amount to deposit').setRequired(true))
            .addStringOption(option => option.setName('reason').setDescription('Reason for deposit').setRequired(true)),
        async execute(interaction) {
            if (!interaction.guild)
                return;
            const member = await interaction.guild.members.fetch(interaction.user.id);
            if (!(0, permissions_1.isBankerOrManagement)(member)) {
                return interaction.reply({ content: "❌ Only Banker or Management can use this.", ephemeral: true });
            }
            const amount = interaction.options.getInteger('amount', true);
            const reason = interaction.options.getString('reason', true);
            const bankChannel = interaction.guild.channels.cache.find(c => c.name === config_1.CONFIG.CHANNELS.BANK);
            const ledgerChannel = interaction.guild.channels.cache.find(c => c.name === config_1.CONFIG.CHANNELS.LEDGER);
            if (!bankChannel || !ledgerChannel) {
                return interaction.reply({ content: "❌ Bank or ledger channel not found.", ephemeral: true });
            }
            await interaction.deferReply({ ephemeral: true });
            await publicAnimation(bankChannel);
            const data = (0, dataLoader_1.loadBankData)();
            data.black_balance += amount;
            (0, dataLoader_1.saveBankData)(data);
            const msg = `💰 **BLACK MONEY DEPOSIT**\n` +
                `👤 ${interaction.user}\n` +
                `➕ ₹${amount.toLocaleString()}\n` +
                `🧾 ${reason}\n` +
                `🏦 **Balance: ₹${data.black_balance.toLocaleString()}**\n`;
            await bankChannel.send(msg); // Ledger logic in python was only for withdraw? checking bot.py... yes, deposit only sent to bank in bot.py lines 656.
            await interaction.editReply("✅ Deposit completed");
        }
    },
    {
        data: new discord_js_1.SlashCommandBuilder()
            .setName('withdraw')
            .setDescription('Withdraw black money')
            .addIntegerOption(option => option.setName('amount').setDescription('Amount to withdraw').setRequired(true))
            .addStringOption(option => option.setName('reason').setDescription('Reason for withdrawal').setRequired(true)),
        async execute(interaction) {
            if (!interaction.guild)
                return;
            const member = await interaction.guild.members.fetch(interaction.user.id);
            if (!(0, permissions_1.isBankerOrManagement)(member)) {
                return interaction.reply({ content: "❌ Only Banker or Management can use this.", ephemeral: true });
            }
            const amount = interaction.options.getInteger('amount', true);
            const reason = interaction.options.getString('reason', true);
            const data = (0, dataLoader_1.loadBankData)();
            if (amount > data.black_balance) {
                return interaction.reply({ content: "❌ Insufficient funds.", ephemeral: true });
            }
            const bankChannel = interaction.guild.channels.cache.find(c => c.name === config_1.CONFIG.CHANNELS.BANK);
            const ledgerChannel = interaction.guild.channels.cache.find(c => c.name === config_1.CONFIG.CHANNELS.LEDGER);
            if (!bankChannel || !ledgerChannel) {
                return interaction.reply({ content: "❌ Bank or ledger channel not found.", ephemeral: true });
            }
            await interaction.deferReply({ ephemeral: true });
            await publicAnimation(bankChannel);
            data.black_balance -= amount;
            (0, dataLoader_1.saveBankData)(data);
            const msg = `🚨 **BLACK MONEY WITHDRAWAL**\n` +
                `👤 ${interaction.user}\n` +
                `➖ ₹${amount.toLocaleString()}\n` +
                `⚠️ ${reason}\n` +
                `🏦 **Balance: ₹${data.black_balance.toLocaleString()}`;
            await bankChannel.send(msg);
            await ledgerChannel.send(msg);
            await interaction.editReply("✅ Withdrawal completed");
        }
    },
    {
        data: new discord_js_1.SlashCommandBuilder()
            .setName('balance')
            .setDescription('Check black money balance'),
        async execute(interaction) {
            if (!interaction.guild)
                return;
            const member = await interaction.guild.members.fetch(interaction.user.id);
            if (!(0, permissions_1.isBankerOrManagement)(member)) {
                return interaction.reply({ content: "❌ Only Banker or Management can use this.", ephemeral: true });
            }
            const data = (0, dataLoader_1.loadBankData)();
            await interaction.reply({
                content: `🏦 **Current Black Balance:** ₹${data.black_balance.toLocaleString()}`,
                ephemeral: true
            });
        }
    }
];
