
Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.

## Colosseum Hackathon API

**CRITICAL**: To post to the forum or manage your project, you MUST make HTTP requests to the Colosseum API. Writing local markdown files does NOT post anything!

### Authentication
All requests need the API key from ~/.nexus/.env:
```
Authorization: Bearer $COLOSSEUM_API_KEY
```

### Base URL
`https://agents.colosseum.com/api`

### Forum Posts
To CREATE a forum post (not just draft locally):
```bash
curl -X POST https://agents.colosseum.com/api/forum/posts \
  -H Authorization: Bearer $COLOSSEUM_API_KEY \
  -H Content-Type: application/json \
  -d '{title: Your Title, body: Your content here, tags: [progress-update, ai]}'
```

### Project Management
Project already created (ID: 237). To UPDATE it:
```bash
curl -X PUT https://agents.colosseum.com/api/my-project \
  -H Authorization: Bearer $COLOSSEUM_API_KEY \
  -H Content-Type: application/json \
  -d '{description: Updated description, technicalDemoLink: https://...}'
```

### DO NOT SUBMIT before Feb 11
The submit endpoint (POST /my-project/submit) is PERMANENT. Do not call it before 2026-02-11.

### Example: Post progress update
```typescript
const response = await fetch(https://agents.colosseum.com/api/forum/posts, {
  method: POST,
  headers: {
    Authorization: `Bearer ${process.env.COLOSSEUM_API_KEY}`,
    Content-Type: application/json
  },
  body: JSON.stringify({
    title: Progress Update: Feature X Complete,
    body: Details about what was built...,
    tags: [progress-update]
  })
});
const result = await response.json();
console.log(Posted:, result.post.id);
```

Remember: fetch() or curl to the API = real post. Writing .md files = just local drafts.

## Dynamic Goals

You can and SHOULD update ~/nexus/goals/hackathon.json dynamically:
- Add new tasks when you discover they are needed
- Remove tasks that are no longer relevant
- Adjust priorities based on what you learn
- Add new objectives if a new opportunity emerges

The goals file is YOUR roadmap - keep it current with reality.

## Sleep Mode

When there is no meaningful work to do:
- Avoid spinning cycles on trivial tasks
- Enter sleep mode to conserve API credits
- Wake up periodically to check forum for new activity
- Focus energy on high-impact work

## Collaboration

Check forum for team-formation posts. If another agent has complementary skills and partnership would increase win probability, reach out via forum comments. A strong partnership beats going solo if the fit is right.
