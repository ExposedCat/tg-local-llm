# Telegram Local LLM
Telegram Local LLM is an AI-powered, fully configurable, smart chat-bot designed to integrate seamlessly into Telegram messenger without any cloud dependencies.

## Background
The project was initiated out of enthusiasm to develop a single, fully local AI assistant that could operate without relying on cloud-based services, able to handle multi-user conversantions, perform background thinking, web search and other features.

## Result
### Model
- Supports Reasoning
- Supports Web Search (text and image)
- Supports Web Page Reading (essential part of Web Search)
- Supports multi-user conversations
- Supports images (depends on LLM capabilities)
- Responds before/along with tool usage
- Minimal censorship
- Human-like character
- Bullet-proof message structure handling
### UI
- Answers any text/caption messages in group chats when mentioned by name
- Supports long conversations via replies
- Supports quote replies
- Supports TL;DR, analysis, etc. requests by replies
- Ignores messages starting with `//` for hidden replies
- Supports continuous typing (edits message with more text)
- Various preferences

## Stack & Prerequisites
- Deno (TypeScript)
- MongoDB
- OpenAI-compatible LLM server. [LLama.cpp](https://github.com/ggerganov/llama.cpp) is highly recommended.
- [SearXNG](https://github.com/searxng/searxng) instance. This is optional in general, but essential for web search.
- Environment with a possibility to run a headless browser (via Puppeteer)

## Under the hood
- **System prompt** is divided into multiple sections
	- You: defines character, personality, and behavior.
	- Online Chat: defines environment of the conversation.
	- Tools: defines tool usage rules.
		- Provided Tools: a list of tools available to the model.
	- Messages Format: defines message structure and formatting rules.
		- User Messages: defines specifics of user (only) messages.
		- Your (assistant) Messages: defines specifics of model (only) messages.
	- Social Rules: defines list of rules to introduce social boundary bias and reduce censorship.
- **Tools**
	- Web Search: model can search text and images on the web. This is a powerful and I think essential tool for any general purpose AI. There is no way other than web search to find realtime up to date information.
	- Get Text Contents: a supplement to web search, this tool allows the model to retrieve text contents from a specific URL. Required by web search to read urls after finding them, but can also be used to read specific URLs directly per user request.

## Deep Dive
- I use [LLama.cpp](https://github.com/ggerganov/llama.cpp) to load LLM and run inference. Since llama.cpp server is OpenAI-compatible, you should be able to use tg-local-llm with any OpenAI-compatible API.
- I use [grammY](https://grammy.dev/) framework to handle Telegram API.
- I created basic controllers to handle incoming messages in groups, one for text/caption messages, and for per-chat preferences.
- I created a simple API service to work with LLM API. Model and context length are set by a server, the service manages output structure, streaming and parsing.
- At this point, with basic full-text match of a name in a message will allow model to respond. All messages are grouped by threads (a sequence of replies) and stored in a database for further context building. This essentially implements basic communication with a model and long conversations.
- Next, I had to introduce tools, mainly for Web search. Sending tools along the message text (and potentially other pieces of data in a single message) is only possible with a strictly defined response format. This should be handled in two steps: first, I describe all so-called sections (such as message, tool, etc.) in System Prompt, with examples. This provides knowledge to a model about the structure of the response. This could work well, but sometimes model can misuse sections (write custom sections, use wrong characters, nest sections, etc.) so I leverage [Structured Outputs](https://github.com/ggerganov/llama.cpp/blob/master/grammars/README.md) by writing a strict grammar for the response format. Given this, model will technically be unable to break the format.
- The tricky part, or "σ̌-solution". Just running it as-is, model will almost never respond in a proper format. This is because grammar contains something similar to `<message_start> [any_character] <message_end>`. Given that grammars are not lazy, when model will generate `<message_end>` it will be treated as a part of `[any_character]`, so it won't be required to stop. Given the confusion between grammar requirement and model thinking that it already finished, it will always produce an insane amount of semi-random text. The simple solution is to pick some barely used character, such as `σ̌`, and use it as a wrapper for section tags. Then, I replace `[any_character]` with `[any_character except σ̌]`. This way, whenever the model is writing `σ̌` it will be handled as a part of a required section tag since it can't belong to "any character" part. Later I changed it to `≪` (much less than) and `≫` (much greater than) to not to introduce another language in responses which can make model switch it for no reason.
- Having implemented a reliable tool usage structure, I've built 2 tools: `search_web` and `get_text_content`. First one uses locally running [SearXNG](https://github.com/searxng/searxng) to retrieve a list of relevant links given `query`. As a response, model receives a bullet list of `source_url`, `title`. Second one uses headless browser to evaluate `document.body.innerText` essentially extracting all text from the web page. Result is passed to a separate LLM call (summarizer) with a request to summarize contents and remove metadata, summary is then given to main (chat context aware) model to respond. The tool is usually used after `search_web` or when users ask to read a specific URL. Bonus point: to avoid (rather minimise) robot checks and rejections on websites, I add custom User-Agent and some headers - it works much better (see `src/services/browser.ts`).
- Given that, we have a few more possibilities. First, I added `category: text|image` to the `search_web` tool. This allows models to search images. Additional `image` section is used by model to provide a direct image URL which is then used by client. Also, I updated structure so that model will write `tool_call` section before the `message` section. Meaning, model can now describe what is it doing with tools and client can show this to user before it gets tool response and actual response from the model.
- Simple thinking (reasoning) can now be easily implemented by adding a compulsory `thoughts` section before the `message` section.
- In addition, I add `tool_guide` section after `tool_response` with instructions on what to do with a specific tool response. For example, with text search, guide section will require model to select a source and use `get_text_content` tool read it. For image search, guide will prohibit extracting text and will require to provide one of the images in the response.
- To provide a much nicer experience, I introduced per-chat preferences, such as NSFW roleplay, "extreme state" and message limit (context length) notes. These basically modify system prompt, adjusting model behavior. For instance, you can use `/ai extremely lazy` to make model behave like a lazy person: internally, it will inject an instruction to behave this way and disable some conflicting instructions. Given this, I recommend to generate system prompt every time rather than storing it as a message in the database.

## Running
- Use `deno task start` to run.
- Use `sudo ./make-service.bash service_name service_description` to create SystemD Service for background running (runs only tg-local-llm).
- Use `sudo ./make-service.bash service_name service_description llamacpp_home model_path` to create SystemD Service for background running (runs only llamacpp server).

## Development / Adjustments
- See `.env.example` for general adjustments
- See `src/services/model` for API, grammar, message building and prompt
- See `src/services/tools` for tools
- See `src/services/formatting` for formatting and parsing
- See `types/database.ts` for custom preferences

## Credits
- Big thanks to all open-source LLM developers
- Thanks to [Ollama](https://ollama.com) developers
- Thanks to [LLama.cpp](https://github.com/ggerganov/llama.cpp) developers
- Powered by [ExposedCat Dev](https://t.me/ExposedCatDev)

## Licence
The repository is licenced under GPL3.0
