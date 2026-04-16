"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizeMessages = summarizeMessages;
const openai_1 = __importDefault(require("openai"));
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
    console.error('❌ OPENAI_API_KEY is not set');
    process.exit(1);
}
const openai = new openai_1.default({ apiKey });
async function summarizeMessages(messages) {
    const formatted = messages.map((m) => `${m.author}: ${m.content}`).join('\n');
    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            {
                role: 'system',
                content: `You are a meeting assistant for a team discussion. Summarize the conversation in English.

Format your response exactly like this (use the exact headers):

👥 **Who said what**
- @username: brief summary of their key points

💬 **Overall opinions**
A concise summary of the main topics discussed and where the group stands overall.

Keep each section concise and focused on substance, not filler.`,
            },
            {
                role: 'user',
                content: formatted,
            },
        ],
    });
    return response.choices[0].message.content ?? '(No summary generated)';
}
