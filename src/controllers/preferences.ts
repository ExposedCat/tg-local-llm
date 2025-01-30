import { Composer } from "grammy";
import { setChatPreferences } from "../services/database.js";
import type { DefaultContext } from "../types/context.js";

export const preferencesController = new Composer<DefaultContext>();
preferencesController
	.chatType(["group", "supergroup"])
	.command("nsfw", async (ctx) => {
		const chatId = ctx.chat.id;
		const value = ["on", "yes", "true", "y"].includes(ctx.match);
		await setChatPreferences(chatId, ctx.db, {
			nsfw: value,
		});
		await ctx.reply(`NSFW is now ${value ? "Enabled" : "Disabled"}`);
	});
