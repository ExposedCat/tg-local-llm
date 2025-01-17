import { startApp } from "./config/app.js";

console.debug("Starting app at ", new Date().toLocaleString());
await startApp();
console.debug("App started");
