import { startApp } from "./config/app.ts";

console.debug("Starting app at ", new Date().toLocaleString());
const dispose = await startApp();
console.debug("App started");

Deno.addSignalListener("SIGINT", dispose);
Deno.addSignalListener("SIGTERM", dispose);
Deno.addSignalListener("SIGUSR1", dispose);
Deno.addSignalListener("SIGUSR2", dispose);
addEventListener("unhandledrejection", dispose);
addEventListener("error", dispose);
