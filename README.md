# Khun Ngern (ขุนเงิน)

A LINE bot that helps friend groups split bills and keep track of who owes whom, right inside the group chat.
The bot calculates, reminds and verifies. It never moves money.

## Repository layout

| Path                  | What lives there                                                                     |
| --------------------- | ------------------------------------------------------------------------------------ |
| `packages/core`       | Money and bill-splitting logic. Pure TypeScript, shared by the bot and the LIFF app. |
| `packages/strings`    | All user-facing Thai copy.                                                           |
| `supabase/functions`  | Backend functions: LINE webhook and the API used by the LIFF pages.                  |
| `supabase/migrations` | Database schema.                                                                     |
| `liff`                | LIFF web pages (bill form).                                                          |
| `docs`                | Task list and project notes.                                                         |

## Getting started

Requires Node 20 or newer.

```sh
npm install
npm run lint
npm run typecheck
```

Copy `.env.example` to `.env` and fill in values for local development. Never commit real secrets.

## Conventions

- Money is always an integer number of satang (1 THB = 100 satang). No floating point for money.
- Reference the feature ID (for example `F1.3`) and the issue number in commits and pull requests.
- Thai copy goes in `packages/strings`, not inline in handlers.
- One task issue per pull request.
