import {
	TOOL_GUIDE_END,
	TOOL_GUIDE_START,
	TOOL_RESPONSE_END,
	TOOL_RESPONSE_START,
} from "../model/prompt.ts";

export const buildToolResponse = (
	prefix: string,
	summary: string,
	guide: string,
) =>
	`${TOOL_RESPONSE_START}\n${prefix}\`\`\`\n${summary}\n\`\`\`\n${TOOL_RESPONSE_END}\n${TOOL_GUIDE_START}\n${guide}\n${TOOL_GUIDE_END}`;
