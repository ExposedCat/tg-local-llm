import {
	METADATA_FIELDS_REGEX,
	TAG_SPECIAL_SEQUENCE,
	TAG_SPECIAL_SEQUENCE_ESCAPED,
} from "./prompt.js";

function makeHeader(input: string) {
	const unicodeMap: Record<string, string> = {
		A: "\uFF21",
		B: "\uFF22",
		C: "\uFF23",
		D: "\uFF24",
		E: "\uFF25",
		F: "\uFF26",
		G: "\uFF27",
		H: "\uFF28",
		I: "\uFF29",
		J: "\uFF2A",
		K: "\uFF2B",
		L: "\uFF2C",
		M: "\uFF2D",
		N: "\uFF2E",
		O: "\uFF2F",
		P: "\uFF30",
		Q: "\uFF31",
		R: "\uFF32",
		S: "\uFF33",
		T: "\uFF34",
		U: "\uFF35",
		V: "\uFF36",
		W: "\uFF37",
		X: "\uFF38",
		Y: "\uFF39",
		Z: "\uFF3A",
	};

	const upperCaseInput = input.toUpperCase();
	return upperCaseInput
		.split("")
		.map((char) => unicodeMap[char] ?? char)
		.join("");
}

export function markdownToHtml(markdown: string) {
	return markdown
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll(/^(\s*)-(?!-)/gm, "$1·")
		.replaceAll(/\[(.+?)\]\(((?:.|\n)+?)\)/g, '<a href="$2">$1</a>')
		.replaceAll(
			/^```(.+?)?\n((?:.|\n)+?)\n```/gm,
			'<pre><code language="$1">$2</code></pre>',
		)
		.replaceAll(/`((?:\n|.)+?)`/g, "<code>$1</code>")
		.replaceAll(/\*\*((?:\n|.)+?)\*\*/g, "<b>$1</b>")
		.replaceAll(/__((?:\n|.)+?)__/g, "<b>$1</b>")
		.replaceAll(/\*((?:\n|.)+?)\*/g, "<i>$1</i>")
		.replaceAll(/_((?:\n|.)+?)_/g, "<i>$1</i>")
		.replaceAll(/^#{3,}(.+?)$/gm, (_, match) => `<b>${match.trim()}</b>`)
		.replaceAll(
			/^##(.+?)$/gm,
			(_, match: string) => `<b>${match.toUpperCase().trim()}</b>`,
		)
		.replaceAll(
			/^#(.+?)$/gm,
			(_, match: string) => `<b>${makeHeader(match).trim()}</b>`,
		);
}

export function escapeInputMessage(message: string) {
	return message
		.replaceAll(
			new RegExp(
				`${TAG_SPECIAL_SEQUENCE_ESCAPED}.+?${TAG_SPECIAL_SEQUENCE_ESCAPED}`,
				"gi",
			),
			"",
		)
		.replaceAll(TAG_SPECIAL_SEQUENCE, "")
		.replaceAll(METADATA_FIELDS_REGEX, "");
}
