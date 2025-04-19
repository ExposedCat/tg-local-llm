import type { Browser } from "puppeteer";
import { scrapePage } from "../browser.ts";
import { generate } from "../model/api.ts";
import type { Message, ToolDefinition } from "../model/types.ts";
import { buildToolResponse } from "./utils.ts";
import { shredContent } from "../model/sub-agents/shredder.ts";
import { buildMessage } from "../model/message.ts";

type GetContentsToolArgs = {
	browser: Browser;
	url: string;

	history: Message[];
};

export async function callGetContentsTool({
	browser,
	url,
	history,
}: GetContentsToolArgs) {
	let content: string;
	let title: string | null = null;
	try {
		const page = await scrapePage(browser, url);
		content = page.text;
		title = page.title;
	} catch {
		content = `Requested URL "${url}" is invalid or unavailable. Don't make up URLs, use another one from search results or user request.`;
	}

	let summary: string | null = null;
	if (title) {
		const headers = await shredContent(content, title);
		if (Object.keys(headers).length !== 0) {
			const headerList = Object.keys(headers)
				.map((header, index) => `${index + 1}. ${header}`)
				.join("\n");

			const { unprocessed: selection } = await generate({
				toolPrompt: "",
				messages: [
					...history,
					buildMessage(
						"system",
						`Given the following titles, select 1 or 2 (select 2 only if 1 would not be enough) which are the most relevant to the user's question and respond with a comma-separated array of indices:
\`\`\`${headerList}\`\`\``,
					),
				],
				grammar: 'root ::= "[" [0-9]+ (("," [0-9]+) | "") "]"',
			});

			const titles = selection.slice(1, -1).split(",").map(Number);
			const values = Object.values(headers);
			content = titles.map((title) => values[title - 1]).join("\n\n");
			const { unprocessed } = await generate({
				toolPrompt:
					"Given raw website contents, write a concise and structured summary without missing anything important. Ignore metadata irrelevant to the page topic. Ensure that the summary contains all exact numbers, objects, events, people, details and facts! If there is an error, provide a detailed explanation of the error along with unmodified error message. If content provided is empty, write 'Article is unavailable'.",
				messages: [
					{
						role: "user",
						content: `Contents: \`\`\`${content}\`\`\`. If this is empty or there is an error, write it in your summary.`,
					},
				],
			});
			summary = unprocessed;
		}
	}

	const prefix = summary
		? `Contents of the article "${url}": `
		: `Article "${url}" is either invalid or unavailable.`;
	const guide = summary
		? "Now use this extra knowledge to answer to the last user message in the chat, read another article from search results or perform search with another query if something is still missing. Consider adding a source hyperlink to the message section."
		: "Tell me user that the article you tried to read is either invalid or unavailable. Use `read_article` tool again but with another article from search results or ask user how to proceed.";

	return buildToolResponse(prefix, summary ?? "<error>", guide);
}

export const readArticleTool: ToolDefinition = {
	name: "read_article",
	description:
		"Extract contents from article by URL. Only use this when you were given a URL.",
	parameters: [
		{
			name: "url",
			type: "string",
			description: "URL of the page to get text contents from.",
		},
	],
};
