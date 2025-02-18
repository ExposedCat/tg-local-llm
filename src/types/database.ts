import type { Collection } from "mongodb";

export type ThreadMessage = {
	role: "user" | "assistant" | "system";
	fromId: number | null;
	content: string;
	images?: string[];
};

export type Thread = {
	chatId: number;
	threadId: number;
	messages: ThreadMessage[];
};

export type ChatPreferences = {
	nsfw?: boolean;
	extremeState?: string;
	showLimit?: boolean;
	showThoughts?: boolean;
	memory?: string[];
};

export type Chat = {
	chatId: number;
	preferences: ChatPreferences;
};

export type Database = {
	thread: Collection<Thread>;
	chat: Collection<Chat>;
};
