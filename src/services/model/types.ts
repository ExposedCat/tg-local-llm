export type Message = {
	role: string;
	content: string;
	images?: string[];
};

export type ToolCall = {
	name: string;
	parameters: Record<string, string | number | undefined>;
};

export type ToolDefinition = {
	name: string;
	description: string;
	parameters: {
		name: string;
		description: string;
		type: string;
	}[];
};
