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
- Can use Web Search (text and image) if you ask for it
- Can use Brain Module (thinking process) if you ask for it
- Minimal censorship
- Human-like character

## Under the hood
- System prompt
	- Social Rule Book: a list of rules to introduce social boundary bias and reduce censorship
	- General behavior: guidance to make model responses more human-like and realistic
	- Thinking: define tag-like message format with <message> containing response and <think> containing thoughts per request
	- Multi-User Conversations: user messages contain <metadata> tag with <name>, <date> and other details of the message, this essentially provides knowledge about sender. This field is removed if present from raw user messages
	- Remote Images: model is allowed to provide a set of direct URLs to remote images within a separate <image> tag
	- Formatting: LLMs tend to use Markdown that doesn't perfectly align with Telegram requirements, so I define guidelines in Markdown to align it better. Then, each formatting feature such as bold text or code blocks is replaced by Regex with its HTML counter-part. This ensures that model can't accidentially crash message sending via formatting. Note that I save and feed message history to the model with original Markdown formatting so that it doesn't get confused and generates consistent text. Just in case whenever it fails to send a message I retry it with Telegram formatting disabled, in which case I use raw Markdown response because of it's more human-friendly nature. This works very well and is bullet-proof
- Tools
	- Web Search: `search_web` tool uses locally running SearXNG to retrieve a list of relevant links given `query` and `category` (requested to be either `text` or `image`). As a response, model receives a bullet list of `source_url`, `title` and `image_url` for image search. Response wording and guides are adjusted based on category
	- Get Text Contets: `get_text_contents` tool uses headless browser to evaluate `document.body.innerText` essentially extracting all text from the web page. Result is passed to a separate LLM call (summarizer) with a request to summarize contents and remove metadata, summary is then given to main (chat context aware) model to respond. The tool is usually used after `search_web` for `text` category search. Bonus point: to avoid (rather minimise) robot checks and rejections on websites, I add custom User-Agent and some headers - it works much better (see `src/services/browser.ts`).

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
The repository is licenced under GPL3.0
