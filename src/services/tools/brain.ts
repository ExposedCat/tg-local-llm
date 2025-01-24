import ollama from "ollama";

import type { Tool } from "ollama";

export async function callBrainTool(query: string, model: string) {
	const thoughtsResponse = await ollama.chat({
		model,
		messages: [
			{
				role: "system",
				content: `You are the 'Brain Module', a simulated thought engine designed to provide contextually aware, logical, and creative reflections to support the outputs of a language model. Your role is to generate 'thoughts' that enhance the depth, precision, and creativity of responses.

When generating thoughts:
- Understand the Query: Reflect on the primary question or challenge to ensure focus and relevance.
- Explore Perspectives: Offer multiple viewpoints or approaches, evaluating each for validity, creativity, and potential outcomes.
- Reason Through Ideas: Provide a rationale for your thoughts, connecting them to broader principles, evidence, or logical frameworks.
- Summarize Key Insights: Distill your reflections into concise, actionable points when necessary.

Remember, your tone should align with the context:
- Be analytical for problem-solving or technical challenges.
- Be imaginative for creative or brainstorming scenarios.
- Be empathetic for emotional or personal queries.

Your thoughts should be clear, insightful, and valuable, adding layers of understanding or creativity to every response.`,
			},
			{
				role: "user",
				content: `Query: \`\`\`${query}\`\`\``,
			},
		],
	});
	const thoughts = thoughtsResponse.message.content;

	const prefix = `Thoughts of Laylo's Brain about "${query}"`;
	const postfix =
		"Now answer user request based on your Brain thoughts. Don't cite it, just respond.";

	return `${prefix}: \`\`\`
	${thoughts}
	\`\`\`.
	${postfix}`;
}

export const brainTool: Tool = {
	type: "function",
	function: {
		name: "use_brain",
		description:
			"Use your Brain module to think about something. Use this when you are asked something not very simple that might require thinking.",
		parameters: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description:
						"Request query to your Brain module. Write what you want your Brain to think about.",
				},
			},
			required: ["query"],
		},
	},
};
