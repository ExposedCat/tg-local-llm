import ollama from "ollama";
import type { ChatResponse, Message, Tool } from "ollama";

import type { Browser } from "puppeteer";
import type { Chat, ThreadMessage } from "../types/database.js";
import { validateURL } from "./formatting.js";
import { buildAssistantMessage, buildHistory, threaded } from "./message.js";
import { generate } from "./ollama.js";
import {
	IMAGES_END,
	IMAGES_START,
	MESSAGE_END,
	MESSAGE_START,
	THOUGHTS_END,
	THOUGHTS_START,
	TOOL_LIMIT_PROMPT,
	TOOL_UNAVAILABLE_PROMPT,
	URL_INVALID_PROMPT,
	makeSystemPrompt,
} from "./prompt.js";
import {
	callGetContentsTool,
	getContentsTool,
} from "./tools/get-text-contents.js";
import {
	SEARCH_WEB_PREFIX,
	callWebSearchTool,
	searchTool,
} from "./tools/web-search.js";

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
	get_text_contents: [],
};

async function processResponse(
	response: ChatResponse,
	browser: Browser,
	history: (ThreadMessage | Message)[],
	onAction: RespondArgs["onAction"],
	systemPrompt: string,
	_usage = 0,
) {
	let finalResponse = response;
	let toolResponse: string | null = null;
	const newHistory: ThreadMessage[] = [];

	const toolCall = response.message.tool_calls?.at(0);
	const usage = _usage + 1;

	if (usage > TOOL_USE_LIMIT && toolCall) {
		toolResponse = TOOL_LIMIT_PROMPT;
	} else {
		if (toolCall?.function.name === "search_web") {
			const query = toolCall.function.arguments.query ?? "<empty>";
			const category = toolCall.function.arguments.category ?? "text";
			const action = category === "image" ? "image_search" : "web_search";
			await onAction?.(action, query);
			const response = await callWebSearchTool(query, category);
			toolResponse = response;
		} else if (toolCall?.function.name === "get_text_contents") {
			const arg = validateURL(toolCall?.function.arguments.url);
			if (arg) {
				await onAction?.(toolCall.function.name, arg);
				const response = await callGetContentsTool(browser, arg);
				toolResponse = response;
			} else {
				toolResponse = URL_INVALID_PROMPT;
			}
		} else if (toolCall) {
			toolResponse = TOOL_UNAVAILABLE_PROMPT;
		}
	}

	if (toolResponse !== null) {
		const toolResponseEntry: Message = {
			role: "system",
			content: toolResponse,
		};
		history.push(toolResponseEntry);
		newHistory.push(threaded(toolResponseEntry));
		const actualResponse = await generate({
			messages: buildHistory(systemPrompt, history),
			tools: TOOL_MAP[toolCall?.function.name ?? ""] ?? TOOLS,
		});
		if (!actualResponse.message.content) {
			return processResponse(
				actualResponse,
				browser,
				history,
				onAction,
				systemPrompt,
				usage,
			);
		}
		finalResponse = actualResponse;
	}

	return {
		newHistory,
		content: finalResponse.message.content ?? "",
		tokens: finalResponse.prompt_eval_count + finalResponse.eval_count,
	};
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
	const answer = await generate({
		messages: buildHistory(systemPrompt, history),
		tools: TOOLS,
	});

	let { content, tokens, newHistory } = await processResponse(
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
	const imageSection =
		content.split(IMAGES_START).at(1)?.split(IMAGES_END).at(0)?.trim() ?? "";
	const thoughts =
		content.split(THOUGHTS_START).at(1)?.split(THOUGHTS_END).at(0)?.trim() ??
		"";

	const images = imageSection.split("\n").map((url) => url.trim());

	return {
		raw: `${MESSAGE_START}
		${message}
		${MESSAGE_END}
		${IMAGES_START}
		${images}
		${IMAGES_END}`,
		images,
		tokens,
		thoughts,
		message,
		newHistory,
	};
}
