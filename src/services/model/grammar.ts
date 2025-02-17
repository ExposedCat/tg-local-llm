import {
	IMAGE_END,
	IMAGE_START,
	MESSAGE_END,
	MESSAGE_START,
	TAG_WRAPPER_CLOSE,
	TAG_WRAPPER_OPEN,
	THOUGHTS_END,
	THOUGHTS_START,
	TOOL_END,
	TOOL_START,
} from "./prompt.ts";
import type { ToolDefinition } from "./types.ts";

const bannedCharacters = Deno.env.get("BAN_CHARACTERS") ?? "";

const escapeToolName = (toolName: string) => toolName.replaceAll("_", "-");

const buildToolGrammar = (tool: ToolDefinition) => {
	const escapedName = escapeToolName(tool.name);
	const parameters = tool.parameters
		.map((parameter) => `\\"${parameter.name}\\": (par-string | par-number)`)
		.join(", ");
	return `par-tool-${escapedName} ::= "{\\"tool_name\\":\\"${tool.name}\\",\\"parameters\\":{${parameters}}}"`;
};

const parAny = (max?: number, min?: number) =>
	`[^${TAG_WRAPPER_OPEN}${TAG_WRAPPER_CLOSE}${bannedCharacters}]{${min ?? 1},${
		max ?? ""
	}}`;

export const grammar = (tools: ToolDefinition[] = []) =>
	`root ::= sec-thoughts ((sec-message) | (sec-tool) | (sec-tool sec-message) | (sec-message sec-attachment) | (sec-tool sec-message sec-attachment))

par-string ::= ("\\"" ${parAny(500)} "\\"")
par-name ::= ([a-z_]+)
par-number ::= ([0-9]+)
par-url ::= ("http" ${parAny(250)})

sec-thoughts ::= "${THOUGHTS_START}\n" ${parAny(5000)} "\n${THOUGHTS_END}\n"

sec-message ::= "${MESSAGE_START}\n" ${parAny(5000)} "\n${MESSAGE_END}\n"

${tools.map(buildToolGrammar).join("\n")}
sec-tool ::= "${TOOL_START}\n" ((${tools
		.map((tool) => escapeToolName(tool.name))
		.join(" | ")}) | "") "\n${TOOL_END}\n"

sec-attachment ::= "${IMAGE_START}\n" (par-url | "") "\n${IMAGE_END}"
`;
