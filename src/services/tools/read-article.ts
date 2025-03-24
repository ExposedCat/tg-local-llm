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
		content = `Requested URL "${url}" is invalid. Don't make up URLs, use one exactly from search results or user request.`;
	}

	let summary = `There was an unknown error reading article "${title}".`;
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
					"Given raw website contents, write a concise and structured summary without missing anything important. Ignore metadata irrelevant to the page topic. Ensure that the summary contains all exact numbers, objects, events, people, details and facts! If there is an error, provide a detailed explanation of the error along with unmodified error message.",
				messages: [
					{
						role: "user",
						content: `Contents: \`\`\`${content}\`\`\``,
					},
				],
			});
			summary = unprocessed;
		}
	}

	const prefix = `Contents of the article "${url}": `;
	const guide =
		"Use this extra knowledge to answer to the last user message in the chat. Respond with actual answer. Consider adding a source hyperlink to the message section.";

	return buildToolResponse(prefix, summary, guide);
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
