import type { I18n } from "@grammyjs/i18n";
import { Bot as TelegramBot, session } from "grammy";

import type { Browser } from "puppeteer";
import { messageController } from "../controllers/message.js";
import { preferencesController } from "../controllers/preferences.js";
import { startController } from "../controllers/start.js";
import { stopController } from "../controllers/stop.js";
import { resolvePath } from "../helpers/resolve-path.js";
import { createReplyWithTextFunc } from "../services/context.js";
import { getOrCreateChatPreferences } from "../services/database.js";
import type { DefaultContext } from "../types/context.js";
import type { Database } from "../types/database.js";
import type { Bot } from "../types/telegram.js";
import { initLocaleEngine } from "./locale-engine.js";

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
	bot.use(startController);
	bot.use(stopController);

	bot.use(preferencesController);

	bot.use(messageController);
}

export async function startBot(database: Database, browser: Browser) {
	const localesPath = resolvePath(import.meta.url, "../locales");
	const i18n = initLocaleEngine(localesPath);
	const bot = new TelegramBot<DefaultContext>(process.env.TOKEN);

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
