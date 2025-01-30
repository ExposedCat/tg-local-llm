import {
	MESSAGE_END,
	MESSAGE_START,
	METADATA_END,
	METADATA_START,
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
	const wrapper = (character: string) =>
		new RegExp(
			`(?<=\\s|^|[(])${character}(.+?)${character}(?=\\s|$|[.,!?:;)]+)`,
			"g",
		);

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
		.replaceAll(wrapper("`"), "<code>$1</code>")
		.replaceAll(wrapper("\\*\\*"), "<b>$1</b>")
		.replaceAll(wrapper("__"), "<b>$1</b>")
		.replaceAll(wrapper("\\*"), "<i>$1</i>")
		.replaceAll(wrapper("_"), "<i>$1</i>")
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
			new RegExp(`${MESSAGE_START}(?:.|\\n)+?${MESSAGE_END}`, "gi"),
			"",
		)
		.replaceAll(
			new RegExp(`${METADATA_START}(?:.|\\n)+?${METADATA_END}`, "gi"),
			"",
		);
}
