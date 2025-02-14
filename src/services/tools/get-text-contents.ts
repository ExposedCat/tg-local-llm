import type { Browser } from "puppeteer";
import { scrapePage } from "../browser.ts";
import { generate } from "../model.ts";
import {
	TOOL_GUIDE_END,
	TOOL_GUIDE_START,
	TOOL_RESPONSE_END,
	TOOL_RESPONSE_START,
	type ToolDefinition,
} from "../prompt.ts";

export async function callGetContentsTool(browser: Browser, url: string) {
	let content: string;
	try {
		content = await scrapePage(browser, url);
	} catch {
		content = `Requested URL "${url}" is invalid. Don't make up URLs, use one exactly from search results or user request.`;
	}

	const { unprocessed: summary } = await generate({
		tools: [],
		preferences: { nsfw: false },
		systemPrompt:
			"Given raw website contents, write a concise and structured summary without missing anything important. Ignore metadata irrelevant to the page topic.",
		messages: [
			{
				role: "user",
				content: `Contents: \`\`\`${content}\`\`\``,
			},
		],
	});

	const prefix = `Contents of the website "${url}": `;
	const postfix =
		"Use this extra knowledge from your web search to answer to the last user message in the chat. Respond with actual answer, don't say \"let's search\" or anything like that. Consider adding a source hyperlink.";

	return `${TOOL_RESPONSE_START}\n${prefix}\`\`\`\n${summary}\n\`\`\`\n${TOOL_RESPONSE_END}\n${TOOL_GUIDE_START}\n${postfix}\n${TOOL_GUIDE_END}`;
}

export const getContentsTool: ToolDefinition = {
	name: "get_text_contents",
	description:
		"Extracts contents from a websites with text. Use this when you need to read some article or open a webpage.",
	parameters: [
		{
			name: "url",
			type: "string",
			description:
				"URL of the page to get text contents from. Don't use image URLs.",
		},
	],
};
