import type { Tool } from "ollama";

const SEARCH_ENDPOINT = "http://127.0.0.1:8080/search?format=json";

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
		.map((entry) => `\n- "${entry.url}": \`${entry.content}\``)
		.join("");

	const prefix = `Web search results for "${query}"`;
	const postfix = `Use these search results to gain knowledge, don't list it all unless requested`;

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
			"Search the web and get the content of the relevant pages. Search for unknown knowledge, news, info, public contact info, weather, etc.",
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
