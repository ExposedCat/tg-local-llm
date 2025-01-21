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
