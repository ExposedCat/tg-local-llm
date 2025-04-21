import type { Browser } from "puppeteer";
import type {
	Chat,
	ChatPreferences,
	ThreadMessage,
} from "../types/database.ts";
import { validateURL } from "./formatting.ts";
import { generate, type GenerateResponse } from "./model/api.ts";
import { buildMessage, threaded } from "./model/message.ts";
import {
	TOOL_LIMIT_PROMPT,
	TOOL_UNAVAILABLE_PROMPT,
	URL_INVALID_PROMPT,
} from "./model/prompt.ts";
import type { Message, ToolDefinition } from "./model/types.ts";
import { callGetContentsTool, readArticleTool } from "./tools/read-article.ts";
import { callWebSearchTool, searchTool } from "./tools/web-search.ts";

export type RespondArgs = {
	history: Message[];
	browser: Browser;
	preferences: Chat["preferences"];
	onAction?: (action: string, arg?: string) => void | Promise<void>;
};

const TOOL_USE_LIMIT = 8;
const TOOLS = [searchTool, readArticleTool];
const TOOL_MAP: Record<string, ToolDefinition[] | undefined> = {
	search_web: [readArticleTool],
	read_article: [searchTool],
};

async function processResponse(
	response: GenerateResponse,
	browser: Browser,
	history: (ThreadMessage | Message)[],
	onAction: RespondArgs["onAction"],
	preferences: ChatPreferences,
	_usage = 0,
) {
	let fallbackTools = TOOLS;
	let finalResponse = response;
	const toolCall = response.tool;

	let toolResponse: string | null = null;
	const newHistory: ThreadMessage[] = [];

	const usage = _usage + 1;

	if (usage > TOOL_USE_LIMIT && toolCall) {
		toolResponse = TOOL_LIMIT_PROMPT;
		fallbackTools = [];
	} else {
		if (toolCall?.name === "search_web") {
			const query = toolCall.parameters.query?.toString() ?? "<empty>";
			const category = toolCall.parameters.category?.toString() ?? "text";
			const action = category === "image" ? "image_search" : "web_search";
			await onAction?.(action, query);
			toolResponse = await callWebSearchTool(query, category);
		} else if (toolCall?.name === "read_article") {
			const arg = validateURL(`${toolCall.parameters.url}`);
			if (arg) {
				await onAction?.(toolCall.name, arg);
				toolResponse = await callGetContentsTool({
					browser,
					url: arg,
					history,
				});
			} else {
				toolResponse = URL_INVALID_PROMPT;
			}
		} else if (toolCall) {
			toolResponse = TOOL_UNAVAILABLE_PROMPT;
		}
	}

	if (toolResponse !== null) {
		const toolResponseEntry: Message = {
			role: "user",
			content: toolResponse,
		};
		history.push(buildMessage("assistant", response.raw), toolResponseEntry);
		newHistory.push(
			threaded(buildMessage("assistant", response.raw)),
			threaded(toolResponseEntry),
		);
		const actualResponse = await generate({
			messages: history,
			tools: TOOL_MAP[toolCall?.name ?? ""] ?? fallbackTools,
			preferences,
			onChunk: onAction,
		});
		if (actualResponse.tool) {
			await onAction?.("chunk_end");
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
		onChunk: onAction,
	});
	await onAction?.("chunk_end");

	return await processResponse(
		response,
		browser,
		history,
		onAction,
		preferences,
	);
}
