import { generate } from "../api.ts";
import { buildMessage } from "../message.ts";
import { NAMES } from "../prompt.ts";

export async function shouldRespond(userInput: string): Promise<boolean> {
	// const { unprocessed } = await generate({
	//   toolPrompt: "",
	//   size: "large",
	//   messages: [
	//     buildMessage(
	//       "system",
	//       `Should ${
	//         NAMES.join(
	//           ",",
	//         )
	//       } answer this message: \`\`\`${userInput}\`\`\` or is it a mention to another person? Respond with "true" or "false"`,
	//     ),
	//   ],
	//   grammar: 'root ::= "true" | "false"',
	// });

	return true;
}
