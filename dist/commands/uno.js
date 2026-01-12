"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const uno_1 = require("../games/uno");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('uno')
    .setDescription('Start a UNO game');
async function execute(interaction) {
    await (0, uno_1.startUnoGame)(interaction);
}
