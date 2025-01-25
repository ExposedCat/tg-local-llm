import ollama from "ollama";
import type { ChatResponse, Message, Tool } from "ollama";

import type { Browser } from "puppeteer";
import type { ThreadMessage } from "../types/database.js";
import { markdownToHtml } from "./formatting.js";
import {
	MESSAGE_TAG,
	METADATA_TAG,
	SYSTEM_PROMPT,
	TAG_HALLUCINATION_REGEX,
	TOOL_LIMIT_PROMPT,
	TOOL_UNAVAILABLE_PROMPT,
} from "./prompt.js";
import { brainTool, callBrainTool } from "./tools/brain.js";
import { callGetContentsTool, getContentsTool } from "./tools/contents.js";
import {
	SEARCH_WEB_PREFIX,
	callWebSearchTool,
	searchTool,
} from "./tools/search.js";

const MODEL = "qwen2.5:14b";

export type RespondArgs = {
	history: Message[];
	browser: Browser;
	onAction?: (action: string, arg?: string) => void | Promise<void>;
};

const TOOL_USE_LIMIT = 5;
const TOOLS = [searchTool, getContentsTool, brainTool];
const TOOL_MAP: Record<string, Tool[]> = {
	search_web: [getContentsTool],
	get_contents: [],
	use_brain: [searchTool, getContentsTool],
};

async function processResponse(
	response: ChatResponse,
	browser: Browser,
	history: (ThreadMessage | Message)[],
	onAction: RespondArgs["onAction"],
	_usage = 0,
) {
	const toolResponses = [];

	const usage = _usage + 1;
	if (usage > TOOL_USE_LIMIT) {
		toolResponses.push(TOOL_LIMIT_PROMPT);
	}

	const toolCall = response.message.tool_calls?.at(0);

	if (history.at(-1)?.content.startsWith(SEARCH_WEB_PREFIX)) {
		history.pop();
	}

	if (toolCall?.function.name === "search_web") {
		const arg = toolCall.function.arguments.query ?? "<empty>";
		await onAction?.(toolCall.function.name, arg);
		const response = await callWebSearchTool(arg);
		toolResponses.push(response);
	} else if (toolCall?.function.name === "get_contents") {
		const arg = toolCall?.function.arguments.url;
		await onAction?.(toolCall.function.name, arg);
		const response = await callGetContentsTool(browser, arg, MODEL);
		toolResponses.push(response);
	} else if (toolCall?.function.name === "use_brain") {
		const arg = toolCall.function.arguments.query;
		await onAction?.(toolCall.function.name, arg);
		const response = await callBrainTool(arg, MODEL);
		toolResponses.push(response);
	} else if (toolCall) {
		toolResponses.push(TOOL_UNAVAILABLE_PROMPT);
	}

	if (toolResponses.length !== 0) {
		history.push(
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
			messages: history,
			tools: TOOL_MAP[toolCall?.function.name ?? ""] ?? TOOLS,
		});
		if (actualResponse.message.content) {
			return actualResponse.message.content;
		}
		return processResponse(actualResponse, browser, history, onAction, usage);
	}

	return response.message.content ?? "";
}

export async function answerChatMessage({
	history,
	browser,
	onAction,
}: RespondArgs) {
	const newHistory: Message[] = [
		{ role: "system", content: SYSTEM_PROMPT },
		...history,
	];

	const answer = await ollama.chat({
		model: MODEL,
		messages: newHistory,
		tools: TOOLS,
	});

	let content = await processResponse(answer, browser, newHistory, onAction);

	if (!content.includes(MESSAGE_TAG)) {
		content = `${MESSAGE_TAG}\n${content}`;
	}
	const index = content.indexOf(MESSAGE_TAG) + MESSAGE_TAG.length + 1;
	const response = content
		.substring(index)
		.replaceAll(TAG_HALLUCINATION_REGEX, "");

	return response;
}
