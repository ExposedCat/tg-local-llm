import type { ChatPreferences } from "../../types/database.ts";
import { grammar } from "./grammar.ts";
import { buildHistory } from "./message.ts";
import {
	IMAGE_END,
	IMAGE_START,
	MESSAGE_END,
	MESSAGE_START,
	TOOL_END,
	TOOL_START,
} from "./prompt.ts";
import type { Message, ToolCall, ToolDefinition } from "./types.ts";

type BaseGenerateArgs = {
	messages: Message[];
};

type ToolGenerateArgs = BaseGenerateArgs & {
	toolPrompt: string;
};

type ChatGenerateArgs = BaseGenerateArgs & {
	preferences: ChatPreferences;
	tools: ToolDefinition[];
	onChunk?: (kind: string, chunk: string) => void | Promise<void>;
};

export type GenerateArgs = ToolGenerateArgs | ChatGenerateArgs;

export type GenerateResponse = {
	message: string;
	image: string | null;
	tool: ToolCall | null;
	raw: string;
	tokensUsed: number;
	unprocessed: string;
};

const getTag = (open: string, close: string, content: string) =>
	content.split(open).at(1)?.split(close).at(0)?.trim() ?? "";

const isToolGenerate = (args: GenerateArgs): args is ToolGenerateArgs =>
	"toolPrompt" in args;

export async function generate(args: GenerateArgs): Promise<GenerateResponse> {
	const toolGenerate = isToolGenerate(args);

	const history = toolGenerate
		? buildHistory(args.messages, [], null, args.toolPrompt)
		: buildHistory(args.messages, args.tools, args.preferences);

	const response = await fetch(Deno.env.get("API_URL") ?? "", {
		method: "POST",
		body: JSON.stringify({
			stream: true,
			messages: history,
			grammar: toolGenerate ? undefined : grammar(),
		}),
	});

	const chunkSize = Number(Deno.env.get("CHUNK_SIZE") ?? 250);

	if (!response.body) {
		throw new Error("Failed to stream completion");
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();

	let tokensUsed = 0;
	let fullResponse = "";
	const tags = [
		{
			tag: "message",
			content: "",
			chunks: 1,
			sentAt: 0,
			open: MESSAGE_START,
			close: MESSAGE_END,
		},
		{
			tag: "image",
			content: "",
			chunks: 1,
			sentAt: 0,
			open: IMAGE_START,
			close: IMAGE_END,
		},
		{
			tag: "tool",
			content: "",
			chunks: 1,
			sentAt: 0,
			open: TOOL_START,
			close: TOOL_END,
		},
	];

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		const part = decoder.decode(value, { stream: true });
		const data = JSON.parse(part.slice(5));
		if (data.choices.at(0)?.finish_reason) {
			tokensUsed = data.usage?.total_tokens ?? 0;
			break;
		}
		const chunk = data.choices.at(0)?.delta.content ?? "";

		fullResponse += chunk;

		for (const tag of tags) {
			tag.content = getTag(tag.open, tag.close, fullResponse);
			if (
				tag.content.length > tag.sentAt &&
				tag.content.length > chunkSize * tag.chunks
			) {
				if (!toolGenerate && tag.tag !== "tool") {
					await args.onChunk?.(tag.tag, tag.content);
				}
				tag.chunks += 1;
				tag.sentAt = tag.content.length;
			}
		}
	}

	for (const tag of tags) {
		if (
			!toolGenerate &&
			tag.content.length > tag.sentAt &&
			tag.tag !== "tool"
		) {
			await args.onChunk?.(tag.tag, tag.content);
		}
	}

	const message = tags[0].content;
	const image = tags[1].content.trim() || null;
	const _tool = tags[2].content;
	let tool: ToolCall | null = null;
	if (_tool.trim()) {
		try {
			const parsed = JSON.parse(_tool);
			if ("tool_name" in parsed && "parameters" in parsed) {
				tool = {
					name: parsed.tool_name,
					parameters: Object.fromEntries(
						Object.entries(parsed.parameters).filter(
							([_, value]) =>
								typeof value === "string" || typeof value === "number",
						) as [string, string | number][],
					),
				};
			}
		} catch (error) {
			console.warn(`Failed to parse tool: ${error}`, _tool);
		}
	}

	const messageSection = `${MESSAGE_START}\n${message}\n${MESSAGE_END}`;
	const toolSection = tool
		? `\n${TOOL_START}\n${tool ? JSON.stringify(tool) : ""}\n${TOOL_END}`
		: "";
	const attachmentSection = image
		? `\n${IMAGE_START}\n${image ?? ""}\n${IMAGE_END}`
		: "";
	const raw = `${messageSection}${toolSection}${attachmentSection}`;

	return { message, tool, image, raw, tokensUsed, unprocessed: fullResponse };
}
