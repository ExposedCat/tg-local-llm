import type { Message, Tool } from "ollama";
import type { ThreadMessage } from "../types/database.js";
import {
	MESSAGE_TAG,
	METADATA_TAG,
	TAG_SPECIAL_SEQUENCE,
	makeSystemPrompt,
} from "./prompt.js";

export type BuildUserMessageArgs = {
	message: string;
	senderName: string;
	images: string[];
};

export function buildAssistantMessage(response: string): Message {
	return {
		role: "assistant",
		content: response,
		images: [],
	};
}

export function buildUserMessage({
	message,
	senderName,
	images,
}: BuildUserMessageArgs): Message {
	const field = (name: string, content: string) =>
		`\n${TAG_SPECIAL_SEQUENCE}${name}="${content}"${TAG_SPECIAL_SEQUENCE}`;

	return {
		role: "user",
		content: `${METADATA_TAG}${field("from", senderName)}${field("message_date", new Date().toLocaleString())}\n${MESSAGE_TAG}\n${message}`,
		images,
	};
}

export const threaded = (message: Message, fromId?: number) =>
	({
		...message,
		fromId: fromId ?? -1,
	}) as ThreadMessage;

export const buildHistory = (messages: Message[], tools: Tool[]): Message[] => [
	{ role: "system", content: makeSystemPrompt(tools) },
	...messages,
];
