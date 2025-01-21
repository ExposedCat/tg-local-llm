import { startApp } from "./config/app.js";

console.debug("Starting app at ", new Date().toLocaleString());
const dispose = await startApp();
console.debug("App started");

process.on("exit", dispose);
process.on("SIGINT", dispose);
process.on("SIGUSR1", dispose);
process.on("SIGUSR2", dispose);
process.on("uncaughtException", dispose);
