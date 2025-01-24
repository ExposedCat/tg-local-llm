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
					"Given raw website contents, write a structured summary without missing anything important. Ignore metadata irrelevant to the page topic.",
			},
			{
				role: "user",
				content: `Contents: \`\`\`${content}\`\`\``,
			},
		],
	});
	const summary = summaryResponse.message.content;

	const prefix = `Summary of the url "${url}" contents that Laylo (you) requested`;
	const postfix = `If this URL from your search shows enough information, write a response to previously given user request and mention url of this page as a source.
		Note that user will not see this summary, only your response.
		Otherwise, you can use get_contents again for another relevant URL.`;

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
					description: "URL of the page to extract contents from",
				},
			},
			required: ["url"],
		},
	},
};
