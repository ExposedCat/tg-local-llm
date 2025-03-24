import type { ChatPreferences, ThreadMessage } from "../../types/database.ts";
import {
	buildSystemPrompt,
	MESSAGE_END,
	MESSAGE_START,
	METADATA_END,
	METADATA_START,
} from "./prompt.ts";
import type { Message, ToolDefinition } from "./types.ts";

export type BuildUserMessageArgs = {
	message: string;
	senderName: string;
	images: string[];
};

export function buildMessage(
	role: "system" | "assistant" | "user",
	response: string,
	images?: string[],
): Message {
	return {
		role,
		content: response,
		images: images ?? [],
	};
}

export function buildUserMessage({
	message,
	senderName,
	images,
}: BuildUserMessageArgs): Message {
	const metadata = `${METADATA_START}\nName: ${senderName}\nDate: ${new Date().toLocaleString()}\n${METADATA_END}`;
	const messageContent = `${MESSAGE_START}\n${message}\n${MESSAGE_END}`;
	return {
		role: "user",
		content: `${metadata}\n${messageContent}`,
		images,
	};
}

export const threaded = (message: Message, fromId?: number) =>
	({
		...message,
		fromId: fromId ?? -1,
	}) as ThreadMessage;

export const buildHistory = (
	messages: Message[],
	tools: ToolDefinition[],
	preferences: ChatPreferences | null,
	systemPrompt?: string,
): Message[] => [
	buildMessage(
		"system",
		systemPrompt ?? buildSystemPrompt(tools, preferences ?? {}),
	),
	...messages,
];
