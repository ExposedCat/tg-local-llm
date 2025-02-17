import type { ToolDefinition } from "../model/types.ts";
import { buildToolResponse } from "./utils.ts";

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

async function searchWeb(
	query: string,
	category: string,
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

export async function callWebSearchTool(query: string, category = "text") {
	const { ok, error, result } = await searchWeb(query, category);
	const resultList = ok
		? result
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
				.join("\n")
		: `Search Web failed: ${error}.`;

	const prefix = ok
		? `Based on user request, select the most relevant ${
				category === "image" ? "image" : "URL"
			} from this list based on descriptions${
				category === "image"
					? ""
					: ". Select only URL which describes information you need to respond to the last user message"
			}: `
		: "";
	const guide = ok
		? `${
				category === "text"
					? "Now you must use get_text_contents tool to read the most relevant URL."
					: "You are not allowed to use get_text_contents now. Pick one image_url which has the most relevant title for the user request. Write a response and attach this image in attachment section"
			}. Note that this ${
				category === "image" ? "source" : "URL"
			} list is supplied by your internal Web Browser, not user, so don't ask user which ${
				category === "image" ? "source" : "URL"
			} to use, pick one yourself based on title relevancy.`
		: "Tell user the error you got with your web search";

	return buildToolResponse(prefix, resultList, guide);
}

export const searchTool: ToolDefinition = {
	name: "search_web",
	description:
		"Perform a web search. Use this when you need to find some realtime or recent information, for some knowledge, weather, people, news, events, etc.",
	parameters: [
		{
			name: "query",
			type: "string",
			description: "Query to search for.",
		},
		{
			name: "category",
			type: "string",
			description: 'Search category. Can only be "text" or "image".',
		},
	],
};
