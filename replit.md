# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Discord bot**: discord.js v14 (runs alongside Express server)

## Discord Bot ("Locos")

The Discord bot runs in the same process as the Express API server, started from `artifacts/api-server/src/index.ts`.

### Bot Commands

| Command | Description |
|---|---|
| `/ping` | Check if bot is online and shows latency |
| `/mod kick <user> [reason]` | Kick a member |
| `/mod ban <user> [reason]` | Ban a member |
| `/mod timeout <user> <duration> [reason]` | Timeout a member (duration in minutes) |
| `/mod unban <userid>` | Unban a user by ID |
| `/mod untimeout <user>` | Remove a member's timeout |
| `/setchannel <feature> [channel]` | Set a channel for media, meme, announcements, or rules |
| `/announce <message> [theme] [title]` | Post a themed announcement embed |
| `/setrules <rules> [theme] [title]` | Post themed server rules |
| `/memespam start [interval]` | Start posting memes (interval in minutes) |
| `/memespam stop` | Stop meme spam |
| `/memespam interval <minutes>` | Change meme spam interval |
| `/memespam status` | Check meme spam status |

### Bot Features

- **Media Channel** — Auto-deletes any text messages without images/videos/media links
- **Meme Spam** — Fetches random memes from meme-api.com and posts on a timer
- **Themed Announces** — Embeds with colors: default, alert, info, success, warning, event
- **Themed Rules** — Formatted numbered rules with color themes

### Bot Settings

Bot channel settings are persisted to `bot-settings.json` in the working directory. Meme spam state also survives restarts.

### Secrets

- `DISCORD_BOT_TOKEN` — The Discord bot token (stored as Replit secret)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server + Discord bot locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
