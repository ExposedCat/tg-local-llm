import puppeteer, { type Browser } from "puppeteer";
import { validateURL } from "./formatting.ts";

export function startBrowser() {
	return puppeteer.launch({
		headless: true,
		args: [
			"--no-sandbox",
			"--disable-setuid-sandbox",
			"--disable-blink-features=AutomationControlled",
			"--disable-infobars",
		],
		defaultViewport: null,
	});
}

export async function scrapePage(browser: Browser, url: string) {
	const page = await browser.newPage();
	const client = await page.createCDPSession();
	await client.send("Page.setDownloadBehavior", {
		behavior: "deny",
	});
	await page.setRequestInterception(true);

	page.on("request", (request) => {
		const isValid = validateURL(request.url()) !== null;
		if (
			!isValid ||
			(request.isNavigationRequest() && request.redirectChain().length !== 0)
		) {
			request.abort();
		} else request.continue();
	});

	await page.setUserAgent(
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
	);
	await page.setExtraHTTPHeaders({
		DNT: "1",
		"Accept-Language": "en-US,en;q=0.9",
	});
	await page.goto(url, {
		waitUntil: "domcontentloaded",
		timeout: 10_000,
	});
	// @ts-expect-error untyped for Deno
	const text = await page.evaluate(() => document.body.innerText);
	// @ts-expect-error untyped for Deno
	const title = await page.evaluate(() => document.title);
	return { text, title };
}
