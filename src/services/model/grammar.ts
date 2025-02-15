import {
	IMAGE_END,
	IMAGE_START,
	MESSAGE_END,
	MESSAGE_START,
	TAG_WRAPPER,
	TOOL_END,
	TOOL_START,
} from "./prompt.ts";

export const grammar =
	() => `root ::= (sec-message) | (sec-tool) | (sec-tool sec-message) | (sec-message sec-attachment) | (sec-tool sec-message sec-attachment)

par-any ::= ([^${TAG_WRAPPER}]+)
par-string ::= ("\\"" par-any "\\"")
par-name ::= ([a-z_]+)
par-number ::= ([0-9]+)
par-url ::= ("http" par-any)

sec-message ::= "${MESSAGE_START}\n" par-any "\n${MESSAGE_END}\n"

par-s-param ::= "\\"" par-name "\\":" (par-string | par-number)*
par-params ::= par-s-param ("," par-s-param)*
par-tool ::= "{\\"tool_name\\":\\"" par-name "\\",\\"parameters\\":{" par-params? "}}"
sec-tool ::= "${TOOL_START}\n" (par-tool | "") "\n${TOOL_END}\n"

sec-attachment ::= "${IMAGE_START}\n" (par-url | "") "\n${IMAGE_END}"
`;
