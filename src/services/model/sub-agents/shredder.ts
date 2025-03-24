import { generate } from "../api.ts";
import { buildMessage } from "../message.ts";

function splitContent(data: string, chunkLength: number): string[] {
	const chunks: string[] = [];
	for (let i = 0; i < data.length; i += chunkLength) {
		chunks.push(data.substring(i, i + chunkLength));
	}
	return chunks;
}

export async function shredContent(
	content: string,
	title: string,
): Promise<Record<string, string>> {
	const chunks = splitContent(content, 10000);
	const headers: Record<string, string> = {};

	for (const chunk of chunks) {
		const { unprocessed } = await generate({
			toolPrompt: `You are a header generator. User will send you a chunk of a "${title}" page and you must write a title for it.
 - You must ignore any metadata, references, and citations and respond in json format with a single field "title" which should describe in a few words (max 5) what the actual text in a chunk is about.
 - If there is only metadata, references, and citations, or the chunk is empty, respond with title "_empty".
 - Do not add any additional information or context to the title. Don't add "${title}" to the title. Title should be a few words (max 5) describing general content.`,
			messages: [buildMessage("user", `Chunk: \`\`\`${chunk}\`\`\``)],
			size: "small",
			grammar: 'root ::= "{\\"title\\":\\"" [A-Za-z0-9_ ]{1,40} "\\"}"',
		});
		const { title: header } = JSON.parse(unprocessed);
		headers[header] = chunk;
	}

	return headers;
}
