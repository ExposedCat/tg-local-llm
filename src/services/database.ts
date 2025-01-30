import type { Chat, Database } from "../types/database";

export async function getOrCreateChatPreferences(
	chatId: number,
	database: Database,
) {
	await database.chat.findOneAndUpdate(
		{ chatId },
		{
			$setOnInsert: {
				preferences: {
					nsfw: false,
				},
			},
		},
		{
			upsert: true,
			returnDocument: "after",
		},
	);
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
