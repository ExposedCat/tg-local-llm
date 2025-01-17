import type { Composer, Bot as TelegramBot } from "grammy";

import type { DefaultContext } from "./context.js";

export type Bot = TelegramBot<DefaultContext>;

export type Middleware = Composer<DefaultContext>;
