import type { Browser } from "puppeteer";
import { scrapePage } from "../browser.ts";
import { generate } from "../model/api.ts";
import type { ToolDefinition } from "../model/types.ts";
import { buildToolResponse } from "./utils.ts";

export async function callGetContentsTool(browser: Browser, url: string) {
	let content: string;
	try {
		content = await scrapePage(browser, url);
	} catch {
		content = `Requested URL "${url}" is invalid. Don't make up URLs, use one exactly from search results or user request.`;
	}

	const { unprocessed: summary } = await generate({
		toolPrompt:
			"Given raw website contents, write a concise and structured summary without missing anything important. Ignore metadata irrelevant to the page topic.",
		messages: [
			{
				role: "user",
				content: `Contents: \`\`\`${content}\`\`\``,
			},
		],
	});

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
