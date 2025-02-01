import ollama, { type Tool, type Message } from "ollama";

const MODEL = "qwen2.5:14b";
const CONTEXT_LENGTH = 20_000;

export type GenerateArgs = {
	messages: Message[];
	tools?: Tool[];
};

export function generate({ messages, tools }: GenerateArgs) {
	return ollama.chat({
		model: MODEL,
		messages,
		tools,
		options: {
			num_ctx: CONTEXT_LENGTH,
		},
	});
}
