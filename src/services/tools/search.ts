import type { Tool } from "ollama";

const SEARCH_ENDPOINT = "http://127.0.0.1:8088/search?format=json";

type SearchEntry = {
	url: string;
	title: string;
	content: string;
};

type SearchApiResponse = {
	results: SearchEntry[];
};

type SearchWebResponse =
	| {
			ok: true;
			error: null;
			result: {
				url: string;
				content: string;
			}[];
	  }
	| {
			ok: false;
			error: string;
			result: null;
	  };

export const SEARCH_WEB_PREFIX = "[Your Web Browser: URL Suggestions]";

async function searchWeb(query: string): Promise<SearchWebResponse> {
	const uri = `${SEARCH_ENDPOINT}&q=${encodeURIComponent(query)}`;
	try {
		const request = await fetch(uri);
		const response: SearchApiResponse = await request.json();
		const formatted = response.results.map((result) => {
			return {
				url: result.url,
				content: result.content,
			};
		});
		return { ok: true, result: formatted, error: null };
	} catch (error) {
		return {
			ok: false,
			result: null,
			error: `${error}`.trim() || "Unknown Error",
		};
	}
}

export async function callWebSearchTool(query: string) {
	const { ok, error, result } = await searchWeb(query);
	if (!ok) {
		return `Search Web failed: ${error}`;
	}
	const resultList = result
		.map((entry) => `\n- URL "${entry.url}": \`${entry.content}\``)
		.join("");

	const prefix = `${SEARCH_WEB_PREFIX} Based on chat history, select the most relevant URL from this list based on descriptions. Select only URLs which describe information you need to respond to the last user message`;
	const postfix =
		"Use get_contents to read the most relevant URL. Note that this URL list is supplied by your internal Web Browser, not user, so don't ask user which URL to use, pick one yourself.";

	return `${prefix}: \`\`\`
	${resultList}
	\`\`\`.
	${postfix}`;
}

export const searchTool: Tool = {
	type: "function",
	function: {
		name: "search_web",
		description:
			"Search the Internet for unknown knowledge, news, info, public contact info, weather, realtime data, etc.",
		parameters: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description: "Search query",
				},
			},
			required: ["query"],
		},
	},
};
