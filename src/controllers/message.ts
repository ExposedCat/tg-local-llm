import { Composer } from "grammy";
import { answerChatMessage } from "../services/chat.js";
import { downloadFile } from "../services/download.js";
import { escapeInputMessage, markdownToHtml } from "../services/formatting.js";
import {
	buildAssistantMessage,
	buildUserMessage,
	threaded,
} from "../services/message.js";
import { createThread, getThread, updateThread } from "../services/thread.js";
import type { DefaultContext } from "../types/context.js";
import type { ThreadMessage } from "../types/database.js";

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
				rawText.toLowerCase().includes("laylo")) &&
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
			let actionMessageId: number | null = null;
			const onAction = async (action: string, arg?: string) => {
				const actionLabels: Record<string, (() => string) | undefined> = {
					web_search: () => `Searching "${arg}"...`,
					image_search: () => `Searching "${arg}" (images)...`,
					get_text_contents: () =>
						`Reading <a href="${arg}">${arg ? new URL(arg).host : "web page"}</a>...`,
				};
				const label = actionLabels[action]?.() ?? action;
				actionText += `\n${label}`;

				if (!actionMessageId) {
					const message = await ctx.reply(actionText);
					actionMessageId = message.message_id;
				} else {
					await ctx.api.editMessageText(
						ctx.chat.id,
						actionMessageId,
						actionText.trim(),
					);
				}
			};

			const { raw, message, images, tokens } = await answerChatMessage({
				browser: ctx.browser,
				history: [...(thread?.messages ?? []), ...inputMessages],
				onAction,
				preferences: ctx.chatPreferences,
			});

			if (actionMessageId) {
				try {
					await ctx.api.deleteMessage(ctx.chat.id, actionMessageId);
				} catch {}
			}

			const responseActions = actionText
				? `<blockquote expandable>${actionText.trim()}</blockquote>`
				: "";

			const safeRespond = async (formatting = true) => {
				try {
					const actionPrefix = formatting
						? responseActions
						: `${actionText}\n\n`;
					const content = formatting ? markdownToHtml(message) : message;

					return await ctx.reply(
						`${actionPrefix}${content}\n\nTokens used: ${tokens}` || "⁠",
						{
							reply_parameters: { message_id: messageId },
							parse_mode: formatting ? "HTML" : undefined,
							message_thread_id: ctx.message.is_topic_message
								? threadId
								: undefined,
							link_preview_options: images.at(0)
								? {
										is_disabled: false,
										prefer_large_media: true,
										url: images[0],
									}
								: undefined,
						},
					);
				} catch (error) {
					if (formatting) {
						console.warn("Failed to respond with formatting:", error);
						return safeRespond(false);
					}
					console.error("Failed to respond:", error);
					return null;
				}
			};

			const responseMessage = await safeRespond();
			if (!responseMessage) {
				return;
			}

			const newMessages: ThreadMessage[] = [
				...inputMessages,
				threaded(buildAssistantMessage(raw)),
			];

			if (responseMessage.message_thread_id) {
				if (!thread) {
					thread = await createThread({
						db: ctx.db,
						chatId,
						threadId: responseMessage.message_thread_id,
						messages: newMessages,
					});
				}
				await updateThread({
					db: ctx.db,
					chatId,
					threadId: responseMessage.message_thread_id,
					messages: newMessages,
				});
			}
		}
	});
