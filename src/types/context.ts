import type { I18nFlavor, TranslationVariables } from "@grammyjs/i18n";
import type { Api, Context, SessionFlavor } from "grammy";
import type { ReplyKeyboardMarkup } from "grammy/types";

import type { Browser } from "puppeteer";
import type { Chat, Database } from "./database.js";

type ReplyKeyboardExtra = { reply_markup: ReplyKeyboardMarkup };

type CustomBase<C extends Context> = {
	text: (
		text: string,
		templateData?: TranslationVariables,
		extra?: Parameters<Api["sendMessage"]>[2],
	) => ReturnType<C["reply"]>;
	db: Database;
	chatPreferences: Chat["preferences"];
	browser: Browser;
	inWar: boolean;
	keyboards: {
		mainMenu: ReplyKeyboardExtra;
		chooseClass: ReplyKeyboardExtra;
	};
};

type BaseContext = Context & I18nFlavor & SessionFlavor<Record<string, never>>;

type ExtendedContext = BaseContext & CustomBase<BaseContext>;

export type DefaultContext = ExtendedContext;
