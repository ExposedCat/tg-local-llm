import {
	IMAGE_END,
	IMAGE_START,
	MESSAGE_END,
	MESSAGE_START,
	TAG_WRAPPER_CLOSE,
	TAG_WRAPPER_OPEN,
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

export const grammar = (tools: ToolDefinition[] = []) =>
	`root ::= (sec-message) | (sec-tool) | (sec-tool sec-message) | (sec-message sec-attachment) | (sec-tool sec-message sec-attachment)

par-any ::= ([^${TAG_WRAPPER_OPEN}${TAG_WRAPPER_CLOSE}${bannedCharacters}]{1,5000})
par-string ::= ("\\"" par-any "\\"")
par-name ::= ([a-z_]+)
par-number ::= ([0-9]+)
par-url ::= ("http" par-any)

sec-message ::= "${MESSAGE_START}\n" par-any "\n${MESSAGE_END}\n"

${tools.map(buildToolGrammar).join("\n")}
sec-tool ::= "${TOOL_START}\n" ((${tools
		.map((tool) => escapeToolName(tool.name))
		.join(" | ")}) | "") "\n${TOOL_END}\n"

sec-attachment ::= "${IMAGE_START}\n" (par-url | "") "\n${IMAGE_END}"
`;
