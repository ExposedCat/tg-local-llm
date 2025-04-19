import {
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
		.map((parameter) => `"\\"${parameter.name}\\":" (par-string | par-number) `)
		.join('","');
	return `par-tool-${escapedName} ::= "{\\"tool_name\\":\\"${tool.name}\\",\\"parameters\\":{"${parameters}"}}"`;
};

const parAny = (max?: number, min?: number, extraBannedCharacters?: string) =>
	`[^${TAG_WRAPPER_OPEN}${TAG_WRAPPER_CLOSE}${bannedCharacters}${
		extraBannedCharacters ?? ""
	}]{${min ?? 1},${max ?? ""}}`;

export const grammar = (tools: ToolDefinition[] = []) =>
	`root ::= sec-thoughts ((sec-tool) | (sec-message) | (sec-message sec-tool))

par-string ::= ("\\"" ${parAny(100, undefined, '\\"')} "\\"")
par-name ::= ([a-z_]+)
par-number ::= ([0-9]+)
par-url ::= ("http" ${parAny(250)})

sec-thoughts ::= "${THOUGHTS_START}\nDialog State: " ${parAny(
		5000,
	)} "\nReasoning: " ${parAny(5000)} "\nNext Steps: " ${parAny(
		5000,
	)} "\n${THOUGHTS_END}\n"

sec-message ::= "${MESSAGE_START}\n" ${parAny(5000)} "\n${MESSAGE_END}\n"

${tools.map(buildToolGrammar).join("\n")}
sec-tool ::= "${TOOL_START}\n" ((${tools
		.map((tool) => `par-tool-${escapeToolName(tool.name)}`)
		.join(" | ")}) | "") "\n${TOOL_END}\n"
`;
