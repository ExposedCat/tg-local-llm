# Telegram bot template

## Stack
- TypeScript
- grammY
- MongoDB

## Architecture
- `index.ts` - entrypoint
- `environment.d.ts` - ENV definitions
- `types` - TypeScript type definitions for the project
- `config` - configuration, preparation and initialization
- `controllers` - to add new handlers. Note: connect at `config/bot.ts`
- `helpers` - project-independent utils
- `services` - project-dependent utils