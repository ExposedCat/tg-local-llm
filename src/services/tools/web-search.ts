import type { Tool } from "ollama";
import { IMAGES_START } from "../prompt.ts";

type SearchEntry = {
	url: string;
	title: string;
	content?: string;
	img_src?: string;
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
				title: string;
				content?: string;
				image?: string;
			}[];
	  }
	| {
			ok: false;
			error: string;
			result: null;
	  };

export const SEARCH_WEB_PREFIX = "[Your Web Browser: URL Results]";

async function searchWeb(
	query: string,
	category: "text" | "image",
): Promise<SearchWebResponse> {
	const uri = `${Deno.env.get("SEARXNG_URL") ?? ""}${
		category === "image" ? "&categories=images" : ""
	}&q=${encodeURIComponent(query)}`;
	try {
		const request = await fetch(uri);
		const response: SearchApiResponse = await request.json();
		const formatted = response.results.map((result) => {
			return {
				url: result.url,
				title: result.title,
				content: result.content,
				image: result.img_src,
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

export async function callWebSearchTool(
	query: string,
	category: "text" | "image" = "text",
) {
	const { ok, error, result } = await searchWeb(query, category);
	if (!ok) {
		return `Search Web failed: ${error}`;
	}
	const resultList = result
		.slice(0, 5)
		.map((entry) => {
			const source = `${
				category === "text" ? "url" : "source"
			}=\`${entry.url}\``;
			const rawTitle =
				category === "text"
					? entry.title
					: `${entry.title} (${entry.content ?? "no description"})`;
			const title = `,title=\`${rawTitle}\``;
			const image =
				category === "image"
					? `,image_url=\`${entry.image ?? "unknown"}\``
					: "";
			return `- ${source}${title}${image}`;
		})
		.join("\n");

	const prefix = `${SEARCH_WEB_PREFIX} Based on user request, select the most relevant ${
		category === "image" ? "image" : "URL"
	} from this list based on descriptions${
		category === "image"
			? ""
			: ". Select only URL which describes information you need to respond to the last user message"
	}`;
	const postfix = `${
		category === "text"
			? "Use get_text_contents to read the most relevant URL"
			: `You are not allowed to use get_text_contents now. Pick one image_url which has the most relevant title for the user request. Write a response and attach this image in a ${IMAGES_START} section`
	}. Note that this ${
		category === "image" ? "source" : "URL"
	} list is supplied by your internal Web Browser, not user, so don't ask user which ${
		category === "image" ? "source" : "URL"
	} to use, pick one yourself based on title relevancy.`;

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
			'Search the Internet for unknown knowledge, news, info, public contact info, weather, realtime data, etc. Always use this when you are asked about some recent events or updates. Don\'t ask user for specific search terms. For image search set category to "image"',
		parameters: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description: "Search query",
				},
				category: {
					type: "string",
					description: 'Can only be "text" or "image"',
				},
			},
			required: ["query", "category"],
		},
	},
};
