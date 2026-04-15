"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const createrooms_1 = require("./commands/createrooms");
const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const rest = new discord_js_1.REST().setToken(token);
(async () => {
    console.log('슬래시 커맨드 등록 중...');
    await rest.put(discord_js_1.Routes.applicationCommands(clientId), {
        body: [createrooms_1.data.toJSON()],
    });
    console.log('✅ /createrooms 커맨드 등록 완료!');
})();
