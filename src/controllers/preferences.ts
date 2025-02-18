import { Composer } from "grammy";
import { addChatMemory, setChatPreferences } from "../services/database.ts";
import { MAIN_NAME } from "../services/model/prompt.ts";
import type { DefaultContext } from "../types/context.ts";
import type { Chat } from "../types/database.ts";

export const preferencesController = new Composer<DefaultContext>();

const databaseFieldMapping: Record<string, keyof Chat["preferences"]> = {
	nsfw: "nsfw",
	extremely: "extremeState",
	limit: "showLimit",
	thoughts: "showThoughts",
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
			`Limit usage will now be ${
				showLimit ? "displayed" : "hidden"
			}. This doesn't affect the actual limit`,
	},
	thoughts: {
		input: "boolean",
		nullable: false,
		message: (showThoughts: boolean) =>
			`Thoughts will now be ${
				showThoughts ? "displayed" : "hidden"
			}. This doesn't affect the actual thinking process`,
	},
};

preferencesController
	.chatType(["group", "supergroup"])
	.command("ai", async (ctx) => {
		const [field, ..._value] = ctx.match.split(" ");
		if (field === "") {
			await ctx.reply(
				`AI Preferences

${ctx.chatPreferences.nsfw ? "🟢" : "🔴"} NSFW
${ctx.chatPreferences.showThoughts ? "🟢" : "🔴"} Display thoughts
${ctx.chatPreferences.showLimit ? "🟢" : "🔴"} Display limit
${
	ctx.chatPreferences.extremeState
		? `🟢 Extremely ${ctx.chatPreferences.extremeState}`
		: "🔴 Normal state"
}`,
			);
			return;
		}

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

preferencesController
	.chatType(["group", "supergroup"])
	.command("remember", async (ctx) => {
		if (ctx.match) {
			await addChatMemory(ctx.chat.id, ctx.db, ctx.match);
			await ctx.reply("Memory saved");
		} else {
			await ctx.reply("Memory not provided");
		}
	});
