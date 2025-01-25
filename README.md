# Telegram Ollama
Telegram Ollama is an AI-powered smart chat-bot designed to integrate seamlessly into Telegram messenger

## Background
The project was initiated out of enthusiasm to develop a single, fully local AI assistant that could operate without relying on cloud-based services, able to handle multi-user conversantions, perform background thinking, web search and other features.

## Usage
- Ask anything in group chats starting with `Laylo, ...`
- Supports long dialogs via replies
- Supports quote replies
- Ignores messages starting with `//` for hidden replies
- Supports TL;DR, analysis, etc. requests by replies
- Works with images (depends on LLM capabilities. Currently used Qwen2.5 doesn't support images)
- Can use Web Search if you ask for it
- Can use Brain Module (thinking process) if you ask for it
- Minimal censorship
- Human-like character

## Under the hood
- System prompt is enough to define Social Rule Book (to introduce social boundary bias and reduce censorship), and general behavior to make model responses more human-like and realistic
- Long multi-user conversations handling, including sender names and message date: we define message metadata structure in a system prompt which is stripped off before sending message to users. Metadata contains some basic fields, each is described within the system prompt; Model is guided to not to write own metadata and ignore unallowed metadata fields from users. Just in case, metadata is cleaned up from raw user messages and AI responses
- Formatting: LLMs tend to use Markdown that doesn't perfectly align with Telegram requirements, so I define guidelines in Markdown to align it better. Then, each formatting feature such as bold text or code blocks is replaced by Regex with its HTML counter-part. This ensures that model can't accidentially crash message sending via formatting. Note that I save and feed message history to the model with original Markdown formatting so that it doesn't get confused and generates consistent text. Just in case whenever it fails to send a message I retry it with Telegram formatting disabled, in which case I use raw Markdown response because of it's more human-friendly nature. This works very well and is bullet-proof
- Background Thinking: I defined a simple `Use Brain` tool. Query supplied by history-aware model is sent to a separate LLM call (thinker model) with a custom "thinker" system prompt. Thinker response is sent back as a system message to the history-aware model to generate an actual response. I also inject hints on next steps to guide model.
- Web Search: this is implemented among with locally running SearXNG instance. First, I defined `Web Search` tool which uses SearXNG to retrieve a list of relevant links upon model request. Then, it uses `Get Page Contents` tool on a selected link to scrape actual contents. I run a headless browser via puppeteer which evaluates `document.body.innerText` on a given page after it's loaded. Raw page text content is sent to a separate LLM call (summarizer model) with a custom "summarizer" system prompt. Summarizer writes a concise and structured summary which is sent back to the history-aware model to finally generate response. At this point there could be a lot of content below user request so sometimes model just describes results without a proper thought on what was requested by user. Bonus point: to avoid (rather minimise) robot checks and rejections, I add custom User-Agent and some headers - it works much better.

## Running
- Use `npm start` to run
- Use `sudo ./make-service.bash service_name service_description` to create SystemD Service

## Development / Adjustments
- Change system prompt at `src/services/prompt.ts`. This includes name and behavior
- Change `MODEL` at `src/services/chat.ts`. Supports any model by [Ollama](https://ollama.com). Model must be pulled first
- Change SearXNG url at `src/services/tools/search.ts`

## Credits
- Big thanks to all open-source LLM developers
- Thanks to [Ollama](https://ollama.com) developers
- Powered by [ExposedCat Dev](https://t.me/ExposedCatDev)

## Licence
Whole repository is licenced under GPL3.0
