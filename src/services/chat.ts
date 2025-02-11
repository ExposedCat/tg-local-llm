import type { ChatResponse, Message, Tool } from "ollama";

import type { Browser } from "puppeteer";
import type { Chat, ThreadMessage } from "../types/database.ts";
import { validateURL } from "./formatting.ts";
import { buildHistory, threaded } from "./message.ts";
import { generate, parseResponse } from "./ollama.ts";
import {
	IMAGES_END,
	IMAGES_START,
	MESSAGE_END,
	MESSAGE_START,
	// THOUGHTS_END,
	// THOUGHTS_START,
	TOOL_LIMIT_PROMPT,
	TOOL_UNAVAILABLE_PROMPT,
	URL_INVALID_PROMPT,
	makeSystemPrompt,
} from "./prompt.ts";
import {
	callGetContentsTool,
	getContentsTool,
} from "./tools/get-text-contents.ts";
import { callWebSearchTool, searchTool } from "./tools/web-search.ts";

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
	let {
		message: finalMessage,
		images: finalImages,
		tokensUsed: finalTokensUsed,
	} = parseResponse(response);

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
		const {
			response: actualResponse,
			images: actualImages,
			message: actualMessage,
			tokensUsed: actualTokensUsed,
		} = await generate({
			messages: buildHistory(systemPrompt, history),
			tools: TOOL_MAP[toolCall?.function.name ?? ""] ?? TOOLS,
			onResponsePartial: (kind, chunk) => onAction?.(kind, chunk),
		});
		if (!actualMessage) {
			return processResponse(
				actualResponse,
				browser,
				history,
				onAction,
				systemPrompt,
				usage,
			);
		}
		finalMessage = actualMessage;
		finalImages = actualImages;
		finalTokensUsed = actualTokensUsed;
	}

	return {
		newHistory,
		message: finalMessage,
		images: finalImages,
		tokensUsed: finalTokensUsed,
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
	const { response } = await generate({
		messages: buildHistory(systemPrompt, history),
		tools: TOOLS,
		onResponsePartial: (kind, chunk) => onAction?.(kind, chunk),
	});

	const { message, images, tokensUsed, newHistory } = await processResponse(
		response,
		browser,
		history,
		onAction,
		systemPrompt,
	);

	return {
		raw: `${MESSAGE_START}
		${message}
		${MESSAGE_END}
		${IMAGES_START}
		${images.join(",")}
		${IMAGES_END}`,
		images,
		tokensUsed,
		// thoughts,
		message,
		newHistory,
	};
}
