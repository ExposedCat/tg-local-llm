import { Bot as TelegramBot, session } from 'grammy';
import type { I18n } from '@grammyjs/i18n';

import type { Bot } from '../types/telegram.js';
import type { Database } from '../types/database.js';
import type { DefaultContext } from '../types/context.js';
import { createReplyWithTextFunc } from '../services/context.js';
import { resolvePath } from '../helpers/resolve-path.js';
import { stopController } from '../controllers/stop.js';
import { startController } from '../controllers/start.js';
import { messageController } from '../controllers/message.js';
import { initLocaleEngine } from './locale-engine.js';

function extendContext(bot: Bot, database: Database) {
  bot.use(async (ctx, next) => {
    ctx.text = createReplyWithTextFunc(ctx);
    ctx.db = database;

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

export async function startBot(database: Database) {
  const localesPath = resolvePath(import.meta.url, '../locales');
  const i18n = initLocaleEngine(localesPath);
  const bot = new TelegramBot<DefaultContext>(process.env.TOKEN);

  extendContext(bot, database);
  setupMiddlewares(bot, i18n);
  setupControllers(bot);

  return new Promise(resolve =>
    bot.start({
      drop_pending_updates: true,
      onStart: () => resolve(undefined),
    }),
  );
}
