import type { Browser } from "puppeteer";
import type {
	Chat,
	ChatPreferences,
	ThreadMessage,
} from "../types/database.ts";
import { validateURL } from "./formatting.ts";
import { threaded } from "./message.ts";
import { type GenerateResponse, type Message, generate } from "./model.ts";
import {
	TOOL_LIMIT_PROMPT,
	TOOL_UNAVAILABLE_PROMPT,
	type ToolDefinition,
	URL_INVALID_PROMPT,
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
const TOOL_MAP: Record<string, ToolDefinition[] | undefined> = {
	search_web: [getContentsTool],
	get_text_contents: [],
};

async function processResponse(
	response: GenerateResponse,
	browser: Browser,
	history: (ThreadMessage | Message)[],
	onAction: RespondArgs["onAction"],
	preferences: ChatPreferences,
	_usage = 0,
) {
	let finalResponse = response;
	const toolCall = response.tool;

	let toolResponse: string | null = null;
	const newHistory: ThreadMessage[] = [];

	const usage = _usage + 1;

	if (usage > TOOL_USE_LIMIT && toolCall) {
		toolResponse = TOOL_LIMIT_PROMPT;
	} else {
		if (toolCall?.name === "search_web") {
			const query = toolCall.parameters.query?.toString() ?? "<empty>";
			const category = toolCall.parameters.category?.toString() ?? "text";
			const action = category === "image" ? "image_search" : "web_search";
			await onAction?.(action, query);
			const response = await callWebSearchTool(query, category);
			toolResponse = response;
		} else if (toolCall?.name === "get_text_contents") {
			const arg = validateURL(`${toolCall.parameters.url}`);
			if (arg) {
				await onAction?.(toolCall.name, arg);
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
			messages: history,
			tools: TOOL_MAP[toolCall?.name ?? ""] ?? TOOLS,
			preferences,
			onResponsePartial: (kind, chunk) => onAction?.(kind, chunk),
		});
		if (actualResponse.tool) {
			return processResponse(
				actualResponse,
				browser,
				history,
				onAction,
				preferences,
				usage,
			);
		}
		finalResponse = actualResponse;
	}

	return {
		newHistory,
		response: finalResponse,
	};
}

export async function answerChatMessage({
	history,
	browser,
	preferences,
	onAction,
}: RespondArgs) {
	const response = await generate({
		messages: history,
		tools: TOOLS,
		preferences,
		onResponsePartial: (kind, chunk) => onAction?.(kind, chunk),
	});

	return await processResponse(
		response,
		browser,
		history,
		onAction,
		preferences,
	);
}
