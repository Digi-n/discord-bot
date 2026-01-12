import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN || "",
    GUILD_ID: "1451761878089990257",
    GENERAL_CHANNEL_ID: "1451808891448066091"
};
