import { I18n } from "i18n";

export function initLocaleEngine(path: string, defaultLocale = "en") {
	const i18n = new I18n({
		directory: path,
		defaultLocale,
		useSession: true,
	});
	return i18n;
}
