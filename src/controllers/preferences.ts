import { Composer } from "grammy";
import { setChatPreferences } from "../services/database.ts";
import { MAIN_NAME } from "../services/prompt.ts";
import type { DefaultContext } from "../types/context.ts";
import type { Chat } from "../types/database.ts";

export const preferencesController = new Composer<DefaultContext>();

const databaseFieldMapping: Record<string, keyof Chat["preferences"]> = {
	nsfw: "nsfw",
	extremely: "extremeState",
	limit: "showLimit",
};

const preferenceResponses = {
	nsfw: {
		input: "boolean",
		nullable: false,
		message: (enabled: boolean) =>
			`NSFW responses are now ${enabled ? "enabled" : "disabled"}`,
	},
	extremely: {
		input: "string",
		nullable: true,
		message: (state: string | undefined) =>
			`${MAIN_NAME} will now be ${state ? `extremely ${state}` : "normal"}`,
	},
	limit: {
		input: "boolean",
		nullable: false,
		message: (showLimit: boolean) =>
			`Limit usage will now be ${showLimit ? "displayed" : "hidden"}`,
	},
};

preferencesController
	.chatType(["group", "supergroup"])
	.command("ai", async (ctx) => {
		const [field, ..._value] = ctx.match.split(" ");
		const value = _value?.join(" ");
		if (!(field in preferenceResponses)) {
			await ctx.reply(`Invalid field: ${field}`);
			return;
		}
		const key = field as keyof typeof preferenceResponses;
		const chatId = ctx.chat.id;
		const info = preferenceResponses[key];
		const typedValue =
			info.input === "boolean"
				? ["on", "yes", "true", "y"].includes(value)
				: value;
		if (!info.nullable && typedValue === undefined) {
			await ctx.reply(`Value for ${field} cannot be empty`);
			return;
		}
		await setChatPreferences(chatId, ctx.db, {
			[databaseFieldMapping[key]]: typedValue,
		});
		await ctx.reply(preferenceResponses[key].message(typedValue as never));
	});
