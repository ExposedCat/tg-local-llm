import type { Browser } from "puppeteer";
import { validateEnv } from "../helpers/validate-env.ts";
import { startBrowser } from "../services/browser.ts";
import type { Database } from "../types/database.ts";
import { startBot } from "./bot.ts";
import { connectToDb } from "./database.ts";

export async function startApp() {
	try {
		validateEnv(["TOKEN", "DB_CONNECTION_STRING", "NAMES"]);
	} catch (error) {
		console.error("Error occurred while loading environment:", error);
		Deno.exit(1);
	}

	let database: Database;
	try {
		database = await connectToDb();
	} catch (error) {
		console.error("Error occurred while connecting to the database:", error);
		Deno.exit(2);
	}

	let browser: Browser;
	try {
		browser = await startBrowser();
	} catch (error) {
		console.error("Error occurred while starting browser:", error);
		Deno.exit(3);
	}

	try {
		await startBot(database, browser);
	} catch (error) {
		console.error("Error occurred while starting the bot:", error);
		Deno.exit(4);
	}

	return async () => {
		await browser.close();
		// TODO: Abort generations
		Deno.exit(0);
	};
}
