import { Composer } from "grammy";
import { answerChatMessage } from "../services/chat.ts";
import { downloadFile } from "../services/download.ts";
import { escapeInputMessage, markdownToHtml } from "../services/formatting.ts";
import {
	buildAssistantMessage,
	buildUserMessage,
	threaded,
} from "../services/message.ts";
import { NAMES } from "../services/prompt.ts";
import { createThread, getThread, updateThread } from "../services/thread.ts";
import type { DefaultContext } from "../types/context.ts";
import type { ThreadMessage } from "../types/database.ts";

function booleanToggle(
	callback: (value: boolean) => Promise<void>,
): Promise<void> {
	try {
		return callback(true);
	} catch {
		return callback(false);
	}
}

type ActionMapper = {
	web_search: () => string;
	image_search: () => string;
	get_text_contents: () => string;
	message: () => string;
	tokens: () => number;
	images: () => string | null;
};

export const messageController = new Composer<DefaultContext>();
messageController
	.chatType(["group", "supergroup"])
	.on([":caption", ":text"], async (ctx) => {
		const senderId = ctx.from.id;
		const senderName = ctx.from.first_name;

		const rawText = ctx.message.text ?? ctx.message.caption;
		const replyQuote = ctx.message.quote?.text
			? `> In reply to: \`${escapeInputMessage(ctx.message.quote.text)}\`\n`
			: "";
		const senderMessageText = `${replyQuote}${escapeInputMessage(rawText)}`;

		const chatId = ctx.chat.id;
		const messageId = ctx.message.message_id;

		const threadId = ctx.message.message_thread_id;
		let thread = !threadId
			? null
			: await getThread({ db: ctx.db, chatId, threadId });

		const replyTo = ctx.message.reply_to_message?.from?.id ?? null;
		const replyToUserName =
			ctx.message.reply_to_message?.from?.first_name ?? "Unknown Sender";
		const replyText =
			ctx.message.reply_to_message?.text ??
			ctx.message.reply_to_message?.caption ??
			"<unsupported message>";

		const shouldReply =
			(thread ||
				(replyTo && replyTo === ctx.me.id) ||
				NAMES.some((name) => rawText.toLowerCase().includes(name))) &&
			!rawText.startsWith("//");

		if (shouldReply) {
			const inputImages: string[] = [];
			if (ctx.message.photo) {
				await ctx.replyWithChatAction("upload_photo");
				const file = await ctx.getFile();
				if (file.file_path) {
					const image = await downloadFile(
						`https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`,
					);
					inputImages.push(image);
				}
			}

			const inputMessages =
				thread || !replyTo
					? []
					: [
							threaded(
								buildUserMessage({
									message: replyText,
									senderName: replyToUserName,
									images: [], // TODO:
								}),
								replyTo,
							),
						];

			const userMessage = threaded(
				buildUserMessage({
					message: senderMessageText,
					senderName,
					images: inputImages,
				}),
				senderId,
			);
			inputMessages.push(userMessage);

			await ctx.replyWithChatAction("typing");

			let actionText = "";
			let messageText = "";
			let image: string | null = null;
			let tokens: number | null = null;

			let responseMessageId: number | null = null;
			let responseMessageThreadId: number | null = null;

			const buildMessage = (formatting: boolean, tokens: number | null) => {
				const limit =
					ctx.chatPreferences.showLimit && tokens !== null
						? `\n\n${formatting ? "<i>" : ""}Message limit${
								formatting ? "</i>" : ""
							}: ${((tokens / Number(Deno.env.get("CONTEXT"))) * 100).toFixed(1)}%`
						: "";
				return `${formatting ? "<blockquote expandable>" : ""}${actionText.trim()}${formatting ? "</blockquote>" : ""}\n\n${formatting ? markdownToHtml(messageText) : messageText}${limit}`;
			};

			const buildExtra = (formatting: boolean) =>
				({
					reply_parameters: { message_id: messageId },
					parse_mode: formatting ? "HTML" : undefined,
					message_thread_id: ctx.message.is_topic_message
						? threadId
						: undefined,
					link_preview_options: image
						? { is_disabled: false, prefer_large_media: true, url: image }
						: undefined,
				}) as Parameters<typeof ctx.api.editMessageText>[3];

			const onAction = async (
				action: string,
				arg?: string | number | string[],
			) => {
				const actionLabels: ActionMapper = {
					web_search: () => `Searching "${arg}"...`,
					image_search: () => `Searching "${arg}" (images)...`,
					get_text_contents: () =>
						`Reading <a href="${arg}">${
							arg ? new URL(arg as string).host : "web page"
						}</a>...`,
					message: () => arg as string,
					tokens: () => arg as number,
					images: () => (arg as string).split(",").at(0) ?? null,
				};
				const processed = actionLabels[action as keyof ActionMapper]?.();
				if (processed) {
					if (action === "message") {
						messageText = processed as string;
					} else if (action === "images") {
						image = processed as string | null;
					} else if (action === "tokens") {
						tokens = processed as number;
					} else {
						actionText += `\n${processed}`;
					}

					await booleanToggle(async (formatting) => {
						if (!responseMessageId) {
							const message = await ctx.reply(
								buildMessage(formatting, tokens ?? null),
								buildExtra(formatting),
							);
							responseMessageId = message.message_id;
							responseMessageThreadId = message.message_thread_id ?? null;
						} else {
							await ctx.api.editMessageText(
								ctx.chat.id,
								responseMessageId,
								buildMessage(formatting, tokens ?? null),
								buildExtra(formatting),
							);
						}
					});
				}
			};

			const { raw, tokensUsed, newHistory } = await answerChatMessage({
				browser: ctx.browser,
				history: [...(thread?.messages ?? []), ...inputMessages],
				onAction,
				preferences: ctx.chatPreferences,
			});

			if (ctx.chatPreferences.showLimit) {
				await onAction("tokens", tokensUsed);
			}

			if (!responseMessageId) {
				return;
			}

			const newMessages: ThreadMessage[] = [
				...inputMessages,
				...newHistory,
				threaded(buildAssistantMessage(raw)),
			];

			if (responseMessageThreadId) {
				if (!thread) {
					thread = await createThread({
						db: ctx.db,
						chatId,
						threadId: responseMessageThreadId,
						messages: newMessages,
					});
				}
				await updateThread({
					db: ctx.db,
					chatId,
					threadId: responseMessageThreadId,
					messages: newMessages,
				});
			}
		}
	});
