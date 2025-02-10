export function validateEnv(requiredEnvs: string[]) {
	for (const env of requiredEnvs) {
		if (!Deno.env.has(env)) {
			throw new Error(`ERROR: Required variable "${env}" is  not specified`);
		}
	}
}
