import ollama from "ollama";
import type { ChatResponse, Message } from "ollama";

import type { Browser } from "puppeteer";
import type { ThreadMessage } from "../types/database.js";
import {
	MESSAGE_TAG,
	METADATA_TAG,
	SYSTEM_PROMPT,
	TAG_HALLUCINATION_REGEX,
	TAG_SPECIAL_SEQUENCE,
} from "./prompt.js";
import { brainTool, callBrainTool } from "./tools/brain.js";
import { callGetContentsTool, getContentsTool } from "./tools/contents.js";
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
	browser: Browser;
	senderName: string;
};

const TOOL_USE_LIMIT = 5;
const TOOLS = [searchTool, getContentsTool, brainTool];

async function processResponse(
	response: ChatResponse,
	browser: Browser,
	history: (ThreadMessage | Message)[],
	_usage = 0,
) {
	const toolResponses = [];

	const usage = _usage + 1;
	if (usage > TOOL_USE_LIMIT) {
		toolResponses.push(
			"At this point write the final response for the user not using any more tools.",
		);
	}

	for (const toolCall of response.message.tool_calls ?? []) {
		console.log(`Tool call: ${toolCall.function.name}`);
		if (toolCall.function.name === "search_web") {
			const response = await callWebSearchTool(
				toolCall.function.arguments.query ?? "<empty>",
			);
			toolResponses.push(response);
		} else if (toolCall.function.name === "get_contents") {
			const response = await callGetContentsTool(
				browser,
				toolCall.function.arguments.url,
				MODEL,
			);
			toolResponses.push(response);
		} else if (toolCall.function.name === "use_brain") {
			const response = await callBrainTool(
				toolCall.function.arguments.query,
				MODEL,
			);
			toolResponses.push(response);
		} else {
			toolResponses.push("Requested tool is not available");
		}
	}

	if (toolResponses.length !== 0) {
		// const userMessage = history.pop() as Message | ThreadMessage;
		history.push(
			...toolResponses.map(
				(response) =>
					({
						role: "system",
						content: response,
					}) as Message,
			),
			// userMessage,
		);
		const actualResponse = await ollama.chat({
			model: MODEL,
			messages: history,
			tools: TOOLS,
		});
		if (actualResponse.message.content) {
			return actualResponse.message.content;
		}
		return processResponse(actualResponse, browser, history, usage);
	}

	return response.message.content ?? "⁠";
}

export async function respond({
	history,
	message,
	senderName,
	browser,
	images,
}: RespondArgs) {
	const userMessage = buildUserMessage({ message, senderName, images });
	const newHistory: (ThreadMessage | Message)[] = [
		{ role: "system", content: SYSTEM_PROMPT },
		...history,
		userMessage,
	];

	const answer = await ollama.chat({
		model: MODEL,
		messages: newHistory,
		tools: TOOLS,
	});

	let content = await processResponse(answer, browser, newHistory);

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
