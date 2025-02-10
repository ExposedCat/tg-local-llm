export declare global {
	namespace NodeJS {
		interface ProcessEnv {
			TOKEN: string;
			DB_CONNECTION_STRING: string;
			SEARXNG_URL: string;
			MODEL: string;
			CONTEXT: string;
		}
	}
}
