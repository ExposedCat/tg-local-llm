# Telegram Ollama
Your digital friend in Telegram messenger, powered up by tools and Artificial Intelligence

## Features
- Ask anything in group chats starting with `Laylo, ...`
- Supports long dialogs via replies
- Works with images (depends on LLM capabilities. Currently used Qwen2.5 doesn't support images)
- Can use local web search if you ask for it
- Minimal censorship
- Realistic character

## Running
- Use `npm start` to run
- Use `sudo ./make-service.bash service_name service_description` to create SystemD Service

## Development / Adjustments
- Change system prompt at `src/services/prompt.ts`. This includes name and behavior
- Change `MODEL` at `src/services/response.ts`. Supports any model by [Ollama](https://ollama.com). Model must be pulled first
- Change SearXNG url at `src/services/tools/search.ts`

## Credits
- Big thanks to all open-source LLM developers
- Thanks to [Ollama](https://ollama.com) developers
- Powered by [ExposedCat Dev](https://t.me/ExposedCatDev)

## Licence
Whole repository is licenced under GPL3.0
