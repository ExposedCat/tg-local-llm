import type { Tool } from "ollama";
import type { Browser } from "puppeteer";
import { scrapePage } from "../browser.ts";
import { generate } from "../ollama.ts";

export const GET_CONTENTS_PREFIX = "[Your Web Browser: Page Text Contents]";

export async function callGetContentsTool(browser: Browser, url: string) {
	let content: string;
	try {
		content = await scrapePage(browser, url);
	} catch {
		content = `Requested URL "${url}" is invalid. Don't make up URLs, use one exactly from search results or user request.`;
	}
	const summaryResponse = await generate({
		messages: [
			{
				role: "system",
				content:
					"Given raw website contents, write a concise and structured summary without missing anything important. Ignore metadata irrelevant to the page topic.",
			},
			{
				role: "user",
				content: `Contents: \`\`\`${content}\`\`\``,
			},
		],
	});
	const summary = summaryResponse.message.content;

	const prefix = `${GET_CONTENTS_PREFIX} You search internet and information on the website "${url}":`;
	const postfix =
		"Use this extra knowledge from your web search to answer to the last user message in the chat. Respond with actual answer, don't say \"let's search\" or anything like that";

	return `${prefix}: \`\`\`
	${summary}
	\`\`\`.
	${postfix}`;
}

export const getContentsTool: Tool = {
	type: "function",
	function: {
		name: "get_text_contents",
		description:
			"Extract text contents of the web page by its URL. Use this to read a web page (either from user or search results). Don't use this for image search!",
		parameters: {
			type: "object",
			properties: {
				url: {
					type: "string",
					description: "URL of the page to get text contents from",
				},
			},
			required: ["url"],
		},
	},
};
