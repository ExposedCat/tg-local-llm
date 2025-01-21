import type { Browser } from "puppeteer";
import { loadEnv } from "../helpers/load-env.js";
import { validateEnv } from "../helpers/validate-env.js";
import { startBrowser } from "../services/browser.js";
import type { Database } from "../types/database.js";
import { startBot } from "./bot.js";
import { connectToDb } from "./database.js";

export async function startApp() {
	try {
		loadEnv("../../.env");
		validateEnv(["TOKEN", "DB_CONNECTION_STRING"]);
	} catch (error) {
		console.error("Error occurred while loading environment:", error);
		process.exit(1);
	}

	let database: Database;
	try {
		database = await connectToDb();
	} catch (error) {
		console.error("Error occurred while connecting to the database:", error);
		process.exit(2);
	}

	let browser: Browser;
	try {
		browser = await startBrowser();
	} catch (error) {
		console.error("Error occurred while starting browser:", error);
		process.exit(3);
	}

	try {
		await startBot(database, browser);
	} catch (error) {
		console.error("Error occurred while starting the bot:", error);
		process.exit(4);
	}

	return async () => {
		await browser.close();
	};
}
