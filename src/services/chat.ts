import ollama from "ollama";
import type { ChatResponse, Message, Tool } from "ollama";

import type { Browser } from "puppeteer";
import type { Chat, ThreadMessage } from "../types/database.js";
import { buildHistory } from "./message.js";
import {
	MESSAGE_END,
	MESSAGE_START,
	THOUGHTS_END,
	THOUGHTS_START,
	TOOL_LIMIT_PROMPT,
	TOOL_UNAVAILABLE_PROMPT,
	makeSystemPrompt,
} from "./prompt.js";
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
	preferences: Chat["preferences"];
	onAction?: (action: string, arg?: string) => void | Promise<void>;
};

const TOOL_USE_LIMIT = 5;
const TOOLS = [searchTool, getContentsTool];
const TOOL_MAP: Record<string, Tool[]> = {
	search_web: [getContentsTool],
	get_contents: [],
};

async function processResponse(
	response: ChatResponse,
	browser: Browser,
	history: (ThreadMessage | Message)[],
	onAction: RespondArgs["onAction"],
	systemPrompt: string,
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
			messages: buildHistory(systemPrompt, history),
			tools: TOOL_MAP[toolCall?.function.name ?? ""] ?? TOOLS,
		});
		if (actualResponse.message.content) {
			return actualResponse.message.content;
		}
		return processResponse(
			actualResponse,
			browser,
			history,
			onAction,
			systemPrompt,
			usage,
		);
	}

	return response.message.content ?? "";
}

export async function answerChatMessage({
	history,
	browser,
	preferences,
	onAction,
}: RespondArgs) {
	const systemPrompt = makeSystemPrompt(
		preferences.nsfw,
		preferences.extremeState,
	);
	const answer = await ollama.chat({
		model: MODEL,
		messages: buildHistory(systemPrompt, history),
		tools: TOOLS,
	});

	let content = await processResponse(
		answer,
		browser,
		history,
		onAction,
		systemPrompt,
	);

	if (!content.includes(MESSAGE_START)) {
		content = `${MESSAGE_START}\n${content}`;
	}
	const message =
		content.split(MESSAGE_START).at(1)?.split(MESSAGE_END).at(0)?.trim() ?? "";
	const thoughts =
		content.split(THOUGHTS_START).at(1)?.split(THOUGHTS_END).at(0)?.trim() ??
		"";

	return {
		raw: `${THOUGHTS_START}
		${thoughts}
		${THOUGHTS_END}
		${MESSAGE_START}
		${message}
		${MESSAGE_END}`,
		thoughts,
		message,
	};
}
