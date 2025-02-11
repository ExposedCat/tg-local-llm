import ollama, { type Tool, type Message, type ChatResponse } from "ollama";
import {
	IMAGES_END,
	IMAGES_START,
	MESSAGE_END,
	MESSAGE_START,
} from "./prompt.ts";

export type GenerateArgs = {
	messages: Message[];
	tools?: Tool[];
	onResponsePartial?: (kind: string, chunk: string) => void | Promise<void>;
};

const getTag = (open: string, close: string, content: string) =>
	content.split(open).at(1)?.split(close).at(0)?.trim() ?? "";

export function parseResponse(
	response: ChatResponse,
	customContent?: string,
	customMessage?: string,
	customImages?: string,
) {
	const finalContent = customContent ?? response.message.content;
	return {
		response: {
			...response,
			message: {
				...response.message,
				content: finalContent,
			},
		},
		message: getTag(MESSAGE_START, MESSAGE_END, customMessage ?? finalContent),
		images: getTag(
			IMAGES_START,
			IMAGES_END,
			customImages ?? finalContent,
		).split(","),
		tokensUsed: response.prompt_eval_count + response.eval_count,
	};
}

export async function generate({
	messages,
	tools,
	onResponsePartial,
}: GenerateArgs) {
	const response = await ollama.chat({
		model: Deno.env.get("MODEL") ?? "qwen2.5:14b",
		messages,
		tools,
		stream: !!onResponsePartial as never,
		options: {
			num_ctx: Number(Deno.env.get("CONTEXT") ?? 2048),
		},
	});

	if (onResponsePartial) {
		const chunkSize = Number(Deno.env.get("CHUNK_SIZE") ?? 250);

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
				tag: "images",
				content: "",
				chunks: 1,
				sentAt: 0,
				open: IMAGES_START,
				close: IMAGES_END,
			},
		];

		let fullResponse = "";
		let lastResponse: ChatResponse | null = null;
		for await (const chunk of response) {
			fullResponse += chunk.message.content;

			for (const tag of tags) {
				tag.content = getTag(tag.open, tag.close, fullResponse);
				if (
					tag.content.length > tag.sentAt &&
					tag.content.length > chunkSize * tag.chunks
				) {
					await onResponsePartial?.(tag.tag, tag.content);
					tag.chunks += 1;
					tag.sentAt = tag.content.length;
				}
			}

			if (chunk.done) {
				lastResponse = chunk;
				break;
			}
		}

		for (const tag of tags) {
			if (tag.content.length > tag.sentAt) {
				await onResponsePartial?.(tag.tag, tag.content);
			}
		}

		if (!lastResponse) {
			throw new Error("No response received");
		}

		return parseResponse(
			lastResponse,
			fullResponse,
			tags[0].content,
			tags[1].content,
		);
	}

	return parseResponse(response as unknown as ChatResponse);
}
