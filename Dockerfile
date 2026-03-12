# ---- Stage 1: Install dependencies ----
FROM node:22-alpine AS deps

WORKDIR /app

RUN npm install -g bun

COPY package.json bun.lock ./

# Install all dependencies (including dev for build)
RUN bun install --frozen-lockfile

# ---- Stage 2: Build TypeScript ----
FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json drizzle.config.ts ./
COPY src ./src

RUN npx tsc

# ---- Stage 3: Production image ----
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy node_modules from deps and compiled output from builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json drizzle.config.ts ./
COPY drizzle ./drizzle

EXPOSE 3000

CMD ["node", "dist/src/index.js"]
