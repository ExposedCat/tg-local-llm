import type { I18n } from "@grammyjs/i18n";
import { Bot as TelegramBot, session } from "grammy";

import type { Browser } from "puppeteer";
import { messageController } from "../controllers/message.js";
import { startController } from "../controllers/start.js";
import { stopController } from "../controllers/stop.js";
import { resolvePath } from "../helpers/resolve-path.js";
import { createReplyWithTextFunc } from "../services/context.js";
import type { DefaultContext } from "../types/context.js";
import type { Database } from "../types/database.js";
import type { Bot } from "../types/telegram.js";
import { initLocaleEngine } from "./locale-engine.js";

function extendContext(bot: Bot, database: Database, browser: Browser) {
	bot.use(async (ctx, next) => {
		ctx.text = createReplyWithTextFunc(ctx);
		ctx.db = database;
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
