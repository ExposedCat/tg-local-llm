import ollama from "ollama";
import type { Message } from "ollama";

import type { ThreadMessage } from "../types/database.js";
import {
	MESSAGE_TAG,
	METADATA_TAG,
	SYSTEM_PROMPT,
	TAG_HALLUCINATION_REGEX,
	TAG_SPECIAL_SEQUENCE,
} from "./prompt.js";
import { callWebSearchTool, searchTool } from "./tools/search.js";

const MODEL = "qwen2.5:14b";

export type BuildUserMessageArgs = {
	message: string;
	senderName: string;
	images: string[];
};

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

export type RespondArgs = {
	history: (ThreadMessage | Message)[];
	message: string;
	images: string[];
	senderName: string;
};

export async function respond({
	history,
	message,
	senderName,
	images,
}: RespondArgs) {
	const userMessage = buildUserMessage({ message, senderName, images });
	const newHistory: (ThreadMessage | Message)[] = [
		{ role: "system", content: SYSTEM_PROMPT },
		...history,
		userMessage,
	];

	let {
		message: { content, tool_calls = [] },
	} = await ollama.chat({
		model: MODEL,
		messages: newHistory,
		tools: [searchTool],
	});

	const toolResponses = [];

	for (const toolCall of tool_calls) {
		if (toolCall.function.name === "search_web") {
			const response = await callWebSearchTool(
				toolCall.function.arguments.query ?? "<empty>",
			);
			toolResponses.push(response);
		}
	}

	if (toolResponses.length !== 0) {
		newHistory.push(
			...toolResponses.map(
				(response) =>
					({
						role: "system",
						content: response,
					}) as Message,
			),
		);
		const actualResponse = await ollama.chat({
			model: MODEL,
			messages: newHistory,
		});
		content = actualResponse.message.content;
	}

	if (!content.includes(MESSAGE_TAG)) {
		content = `${MESSAGE_TAG}\n${content}`;
	}
	const index = content.indexOf(MESSAGE_TAG) + MESSAGE_TAG.length + 1;
	const response = content
		.substring(index)
		.replaceAll(TAG_HALLUCINATION_REGEX, "")
		.replaceAll("*", "-")
		.replaceAll(/--(.+?)--/gm, "*$1*")
		.replaceAll(/(\s|^)-([^- ].+?[^- ])-(\s|$)/gm, "$1\\*_$2_\\*$3")
		.trim();

	return { response, userMessage };
}
