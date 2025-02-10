import type { Message, ToolCall } from "ollama";
import type { ThreadMessage } from "../types/database.js";
import {
	MESSAGE_END,
	MESSAGE_START,
	METADATA_END,
	METADATA_START,
} from "./prompt.js";

export type BuildUserMessageArgs = {
	message: string;
	senderName: string;
	images: string[];
};

export function buildAssistantMessage(
	response: string,
	toolCalls?: ToolCall[],
): Message {
	return {
		role: "assistant",
		content: response,
		images: [],
		tool_calls: toolCalls ?? [],
	};
}

export function buildUserMessage({
	message,
	senderName,
	images,
}: BuildUserMessageArgs): Message {
	const field = (name: string, content: string) =>
		`\n<${name}>${content}</${name}>`;

	return {
		role: "user",
		content: `${METADATA_START}${field("from", senderName)}${field("message_date", new Date().toLocaleString())}\n${METADATA_END}\n${MESSAGE_START}\n${message}\n${MESSAGE_END}`,
		images,
	};
}

export const threaded = (
	{ tool_calls, ...message }: Message,
	fromId?: number,
) =>
	({
		...message,
		toolCalls: tool_calls,
		fromId: fromId ?? -1,
	}) as ThreadMessage;

export const buildHistory = (
	systemPrompt: string,
	messages: Message[],
): Message[] => [{ role: "system", content: systemPrompt }, ...messages];
