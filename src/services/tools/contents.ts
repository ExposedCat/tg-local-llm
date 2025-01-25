import ollama from "ollama";

import type { Tool } from "ollama";
import type { Browser } from "puppeteer";

async function scrapePage(browser: Browser, url: string) {
	const page = await browser.newPage();
	await page.setUserAgent(
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
	);
	await page.setExtraHTTPHeaders({
		DNT: "1",
		"Accept-Language": "en-US,en;q=0.9",
	});
	await page.goto(url, { waitUntil: "domcontentloaded" });
	const text = await page.evaluate(() => document.body.innerText);
	return text;
}

export const GET_CONTENTS_PREFIX = "[Your Web Browser: Page Contents]";

export async function callGetContentsTool(
	browser: Browser,
	url: string,
	model: string,
) {
	let content = `Requested URL "${url}" is invalid. Don't make up URLs, use one exactly from search results or user request.`;
	try {
		content = await scrapePage(browser, url);
	} catch {}
	const summaryResponse = await ollama.chat({
		model,
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
		"Use this extra knowledge from your web search to answer to the last user message in the chat";

	return `${prefix}: \`\`\`
	${summary}
	\`\`\`.
	${postfix}`;
}

export const getContentsTool: Tool = {
	type: "function",
	function: {
		name: "get_contents",
		description:
			"Extract contents of the web page by its URL. Always use this after using web_search or when user explicitly asked you to",
		parameters: {
			type: "object",
			properties: {
				url: {
					type: "string",
					description: "URL of the page to get contents from",
				},
			},
			required: ["url"],
		},
	},
};
