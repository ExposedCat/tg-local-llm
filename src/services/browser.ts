import puppeteer, { type Browser } from "puppeteer";

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
	await page.setUserAgent(
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
	);
	await page.setExtraHTTPHeaders({
		DNT: "1",
		"Accept-Language": "en-US,en;q=0.9",
	});
	await page.goto(url, { waitUntil: "domcontentloaded" });
	const text = await page.evaluate(() => document.body.innerText);
	return text;
}
