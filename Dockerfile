FROM node:22-alpine AS deps

WORKDIR /app

RUN npm install -g bun

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile

FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=deps /usr/local/lib/node_modules/bun /usr/local/lib/node_modules/bun
COPY --from=deps /usr/local/bin/bun /usr/local/bin/bun
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json drizzle.config.ts ./
COPY src ./src

RUN bun run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

EXPOSE 3000

CMD ["node", "dist/index.mjs"]
