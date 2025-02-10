import type { Collection } from "npm:mongodb";
import type { ToolCall } from "npm:ollama";

export type ThreadMessage = {
	role: "user" | "assistant" | "system";
	fromId: number | null;
	content: string;
	images?: string[];
	toolCalls?: ToolCall[];
};

export type Thread = {
	chatId: number;
	threadId: number;
	messages: ThreadMessage[];
};

export type Chat = {
	chatId: number;
	preferences: {
		nsfw: boolean;
		extremeState?: string;
		showLimit?: boolean;
	};
};

export type Database = {
	thread: Collection<Thread>;
	chat: Collection<Chat>;
};
