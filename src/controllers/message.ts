import { Composer } from "grammy";
import { answerChatMessage } from "../services/chat.ts";
import { downloadFile } from "../services/download.ts";
import { escapeInputMessage, markdownToHtml } from "../services/formatting.ts";
import {
	buildMessage,
	buildUserMessage,
	threaded,
} from "../services/model/message.ts";
import { NAMES } from "../services/model/prompt.ts";
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
	thoughts: () => string;
	tokens: () => number;
	addImage: () => string;
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

		const threadId = ctx.message.reply_to_message?.is_topic_message
			? undefined
			: ctx.message.message_thread_id;

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
			let thoughtsText = "";
			let image: string | null = null;
			let tokens: number | null = null;

			let responseMessageId: number | null = null;
			let responseMessageThreadId: number | null = null;

			const makeNote = (content: string, formatting: boolean) =>
				`\n\n${formatting ? `<i>${content}</i>` : content}`;

			const buildResponseMessage = (
				formatting: boolean,
				finished: boolean | null,
				tokens: number | null,
			) => {
				const actions = `${
					formatting ? "<blockquote expandable>" : ""
				}${actionText.trim()}${formatting ? "</blockquote>" : ""}`;
				const thoughts = thoughtsText.trim()
					? `\n${
							formatting ? "<blockquote expandable>" : ""
						}${thoughtsText.trim()}${formatting ? "</blockquote>" : ""}`
					: "";
				const limit =
					ctx.chatPreferences.showLimit && tokens !== null
						? `${makeNote("Message limit", formatting)}: ${(
								(tokens / Number(Deno.env.get("CONTEXT"))) * 100
							).toFixed(1)}%`
						: "";
				const state = finished ? "" : makeNote("Typing...", formatting);
				const note = `${limit}${state}`;
				const message = `${
					formatting ? markdownToHtml(messageText) : messageText
				}`;
				return `${actions}${thoughts}\n\n${message}${note}`;
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
						: { is_disabled: true },
				}) as Parameters<typeof ctx.api.editMessageText>[3];

			const onAction = async (
				action: string,
				value?: string | number | string[],
			) => {
				const actionLabels: ActionMapper = {
					web_search: () => `Searching "${value}"...`,
					image_search: () => `Searching "${value}" (images)...`,
					get_text_contents: () =>
						`Reading <a href="${value}">${
							value ? new URL(value as string).host : "web page"
						}</a>...`,
					message: () => value as string,
					thoughts: () => value as string,
					addImage: () => value as string,
					tokens: () => value as number,
				};
				const processed = actionLabels[action as keyof ActionMapper]?.();
				if (processed || action === "finish") {
					if (action === "message") {
						messageText = processed as string;
					} else if (action === "thoughts") {
						if (!ctx.chatPreferences.showThoughts) {
							return;
						}
						thoughtsText = processed as string;
					} else if (action !== "finish") {
						actionText += `\n${processed}`;
					}

					await booleanToggle(async (formatting) => {
						const messageText = buildResponseMessage(
							formatting,
							action === "finish",
							tokens ?? null,
						);
						if (!responseMessageId) {
							const message = await ctx.reply(
								messageText,
								buildExtra(formatting),
							);
							responseMessageId = message.message_id;
							responseMessageThreadId = message.message_thread_id ?? null;
						} else {
							try {
								await ctx.api.editMessageText(
									ctx.chat.id,
									responseMessageId,
									messageText,
									buildExtra(formatting),
								);
							} catch (error) {
								if (!formatting) {
									console.error("Failed to edit message:", error);
								}
							}
						}
					});
				}
			};

			const { response, newHistory } = await answerChatMessage({
				browser: ctx.browser,
				history: [...(thread?.messages ?? []), ...inputMessages],
				onAction,
				preferences: ctx.chatPreferences,
			});

			if (response.image) {
				image = response.image;
			}
			if (ctx.chatPreferences.showLimit) {
				tokens = response.tokensUsed;
			}

			if (response.message || ctx.chatPreferences.showLimit) {
				await onAction("finish");
			}

			if (!responseMessageId) {
				return;
			}

			const newMessages: ThreadMessage[] = [
				...inputMessages,
				...newHistory,
				threaded(buildMessage("assistant", response.raw)),
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
