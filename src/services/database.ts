import type { Chat, Database } from "../types/database.ts";

export const CHAT_MEMORY_LIMIT = 5;
export const CHAT_MEMORY_SIZE_LIMIT = 500;

export async function getOrCreateChatPreferences(
	chatId: number,
	database: Database,
) {
	const entry = await database.chat.findOneAndUpdate(
		{ chatId },
		{
			$setOnInsert: {
				preferences: {
					nsfw: false,
					showLimit: false,
					showThoughts: false,
					memory: [],
				},
			},
		},
		{
			upsert: true,
			returnDocument: "after",
		},
	);
	// biome-ignore lint/style/noNonNullAssertion: upsert ensures value
	return entry!;
}

export async function setChatPreferences(
	chatId: number,
	database: Database,
	preferences: Partial<Chat["preferences"]>,
) {
	await database.chat.findOneAndUpdate(
		{ chatId },
		{
			$set: Object.fromEntries(
				Object.entries(preferences).map(([key, value]) => [
					`preferences.${key}`,
					value,
				]),
			),
		},
		{
			upsert: true,
			returnDocument: "after",
		},
	);
}

export async function addChatMemory(
	chatId: number,
	database: Database,
	memory: string,
) {
	const truncated = memory.slice(0, CHAT_MEMORY_SIZE_LIMIT);
	await database.chat.updateOne(
		{ chatId },
		{
			$push: {
				"preferences.memory": {
					$each: [truncated],
					$slice: -CHAT_MEMORY_LIMIT,
				},
			},
		},
	);
}

export async function removeChatMemory(
	chatId: number,
	database: Database,
	memory: string,
) {
	await database.chat.updateOne(
		{ chatId },
		{
			$pull: {
				"preferences.memory": memory,
			},
		},
	);
}
