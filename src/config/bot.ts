import { Bot as TelegramBot, session } from "grammy";
import type { I18n } from "i18n";

import type { Browser } from "npm:puppeteer";
import { messageController } from "../controllers/message.ts";
import { preferencesController } from "../controllers/preferences.ts";
import { resolvePath } from "../helpers/resolve-path.ts";
import { createReplyWithTextFunc } from "../services/context.ts";
import { getOrCreateChatPreferences } from "../services/database.ts";
import type { DefaultContext } from "../types/context.ts";
import type { Database } from "../types/database.ts";
import type { Bot } from "../types/telegram.ts";
import { initLocaleEngine } from "./locale-engine.ts";

function extendContext(bot: Bot, database: Database, browser: Browser) {
	bot.api.config.use((prev, method, payload, signal) => {
		if (
			!payload ||
			(!method.startsWith("edit") && !method.startsWith("send")) ||
			method === "sendChatAction"
		) {
			return prev(method, payload, signal);
		}
		return prev(
			method,
			{
				...payload,
				parse_mode: "parse_mode" in payload ? payload.parse_mode : "HTML",
				reply_parameters:
					"reply_parameters" in payload
						? {
								allow_sending_without_reply: true,
								quote_parse_mode: "HTML",
								...payload.reply_parameters,
							}
						: undefined,
				link_preview_options: {
					is_disabled: true,
					...("link_preview_options" in payload
						? payload.link_preview_options
						: {}),
				},
			},
			signal,
		);
	});

	bot.use(async (ctx, next) => {
		ctx.text = createReplyWithTextFunc(ctx);
		ctx.db = database;
		if (ctx.chat?.id) {
			const chat = await getOrCreateChatPreferences(ctx.chat.id, database);
			ctx.chatPreferences = chat?.preferences;
		}
		ctx.browser = browser;

		await next();
	});
}

function setupMiddlewares(bot: Bot, localeEngine: I18n) {
	bot.use(session());
	bot.use(localeEngine.middleware());
	// eslint-disable-next-line github/no-then
	bot.catch(console.error);
}

function setupControllers(bot: Bot) {
	bot.use(preferencesController);

	bot.use(messageController);
}

export function startBot(database: Database, browser: Browser) {
	const localesPath = resolvePath(import.meta.url, "../locales");
	const i18n = initLocaleEngine(localesPath);
	const bot = new TelegramBot<DefaultContext>(Deno.env.get("TOKEN") ?? "");

	extendContext(bot, database, browser);
	setupMiddlewares(bot, i18n);
	setupControllers(bot);

	return new Promise((resolve) =>
		bot.start({
			drop_pending_updates: true,
			onStart: () => resolve(undefined),
		}),
	);
}
