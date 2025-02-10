import ollama, { type Tool, type Message } from "ollama";

export type GenerateArgs = {
	messages: Message[];
	tools?: Tool[];
};

export function generate({ messages, tools }: GenerateArgs) {
	return ollama.chat({
		model: process.env.MODEL,
		messages,
		tools,
		options: {
			num_ctx: Number(process.env.CONTEXT),
		},
	});
}
