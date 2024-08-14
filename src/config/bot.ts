import { Bot as TelegramBot, session } from 'grammy';
import type { I18n } from '@grammyjs/i18n/dist/source/i18n.js';

import type { Bot } from '../types/telegram.js';
import type { Chat, Database } from '../types/database.js';
import type { CustomContext } from '../types/context.js';
import { buildName, getOrCreateUser } from '../services/user.js';
import { createReplyWithTextFunc } from '../services/context.js';
import { getOrCreateChat } from '../services/chat.js';
import { resolvePath } from '../helpers/resolve-path.js';
import { stopController } from '../controllers/stop.js';
import { startController } from '../controllers/start.js';
import { initLocaleEngine } from './locale-engine.js';

function extendContext(bot: Bot, database: Database) {
  bot.use(async (ctx, next) => {
    if (!ctx.chat || !ctx.from) {
      return;
    }

    ctx.text = createReplyWithTextFunc(ctx);
    ctx.db = database;

    let chat: Chat | null = null;
    if (ctx.chat.type !== 'private') {
      chat = await getOrCreateChat({
        db: database,
        chatId: ctx.chat.id,
        title: ctx.chat.title,
      });
    }

    ctx.dbEntities = {
      user: await getOrCreateUser({
        db: database,
        userId: ctx.from.id,
        name: buildName(ctx.from.first_name, ctx.from.last_name),
      }),
      chat,
    };

    await next();
  });
}

function setupPreControllers(_bot: Bot) {
  // e.g. inline-mode controllers
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
}

export async function startBot(database: Database) {
  const localesPath = resolvePath(import.meta.url, '../locales');
  const i18n = initLocaleEngine(localesPath);
  const bot = new TelegramBot<CustomContext>(process.env.TOKEN);

  setupPreControllers(bot);
  extendContext(bot, database);
  setupMiddlewares(bot, i18n);
  setupControllers(bot);

  return new Promise(resolve =>
    bot.start({
      onStart: () => resolve(undefined),
    }),
  );
}
