"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIG = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN || "",
    GUILD_ID: "1451761878089990257",
    GENERAL_CHANNEL_ID: "1451808891448066091"
};
