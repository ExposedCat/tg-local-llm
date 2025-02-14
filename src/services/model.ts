import type { ChatPreferences } from "../types/database.ts";
import { buildHistory } from "./message.ts";
import {
	IMAGE_END,
	IMAGE_START,
	MESSAGE_END,
	MESSAGE_START,
	TAG_WRAPPER,
	TOOL_END,
	TOOL_START,
} from "./prompt.ts";
import type { ToolDefinition } from "./prompt.ts";

export type Message = {
	role: string;
	content: string;
	images?: string[];
};

export type ToolCall = {
	name: string;
	parameters: Record<string, string | number | undefined>;
};

export type GenerateArgs = {
	preferences: ChatPreferences;
	messages: Message[];
	tools: ToolDefinition[];
	onResponsePartial?: (kind: string, chunk: string) => void | Promise<void>;
	systemPrompt?: string;
};

export type GenerateResponse = {
	message: string;
	image: string | null;
	tool: ToolCall | null;
	raw: string;
	tokensUsed: number;
	unprocessed: string;
};

const getTag = (open: string, close: string, content: string) =>
	content
		.split(new RegExp(`.${open.slice(1, -1)}.`))
		.at(1)
		?.split(new RegExp(`.${close.slice(1, -1)}.`))
		.at(0)
		?.trim() ?? "";

export async function generate({
	tools,
	preferences,
	messages,
	onResponsePartial,
	systemPrompt,
}: GenerateArgs): Promise<GenerateResponse> {
	const history = buildHistory(messages, tools, preferences, systemPrompt);
	const response = await fetch("http://127.0.0.1:8181/v1/chat/completions", {
		method: "POST",
		body: JSON.stringify({
			stream: true,
			messages: history,
			grammar: !onResponsePartial
				? undefined
				: `root ::= (sec-message) | (sec-tool) | (sec-message sec-tool) | (sec-message sec-attachment) | (sec-message sec-tool sec-attachment)

par-any ::= ([^${TAG_WRAPPER}]+)
par-string ::= ("\\"" par-any "\\"")
par-name ::= ([a-z_]+)
par-number ::= ([0-9]+)
par-url ::= ("http" par-any)

sec-message ::= "${MESSAGE_START}\nHey, " par-any "\n${MESSAGE_END}\n"

par-s-param ::= "\\"" par-name "\\":" (par-string | par-number)*
par-params ::= par-s-param ("," par-s-param)*
par-tool ::= "{\\"tool_name\\":\\"" par-name "\\",\\"parameters\\":{" par-params? "}}"
sec-tool ::= "${TOOL_START}\n" (par-tool | "") "\n${TOOL_END}\n"

sec-attachment ::= "${IMAGE_START}\n" (par-url | "") "\n${IMAGE_END}"
`,
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
				if (tag.tag !== "tool") {
					await onResponsePartial?.(tag.tag, tag.content);
				}
				tag.chunks += 1;
				tag.sentAt = tag.content.length;
			}
		}
	}

	for (const tag of tags) {
		if (tag.content.length > tag.sentAt && tag.tag !== "tool") {
			await onResponsePartial?.(tag.tag, tag.content);
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
