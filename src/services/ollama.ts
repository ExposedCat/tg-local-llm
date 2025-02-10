import ollama, { type Tool, type Message } from "ollama";

export type GenerateArgs = {
	messages: Message[];
	tools?: Tool[];
};

export function generate({ messages, tools }: GenerateArgs) {
	return ollama.chat({
		model: Deno.env.get("MODEL") ?? "qwen2.5:14b",
		messages,
		tools,
		options: {
			num_ctx: Number(Deno.env.get("CONTEXT") ?? 2048),
		},
	});
}
