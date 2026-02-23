# TrueKhmer API

A RESTful API built with **Hono.js**, **Drizzle ORM**, and **PostgreSQL**.

## Tech Stack

- **Runtime:** Node.js
- **Framework:** [Hono.js](https://hono.dev/)
- **ORM / Query Builder:** [Drizzle ORM](https://orm.drizzle.team/)
- **Database:** PostgreSQL
- **Language:** TypeScript

## Getting Started

### Prerequisites

- Node.js >= 18
- PostgreSQL database

### Installation

```bash
bun install
```

### Environment Variables

Copy `.env.example` to `.env` and update the values:

```bash
cp .env.example .env
```

| Variable       | Description                  | Default                                               |
| -------------- | ---------------------------- | ----------------------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:password@localhost:5432/truekhmer` |
| `PORT`         | Server port                  | `3000`                                                |

### Database Setup

Push the schema to your database:

```bash
bun run db:push
```

Or generate and run migrations:

```bash
bun run db:generate
bun run db:migrate
```

### Development

```bash
bun run dev
```

The server will start at `http://localhost:3000`.

### Production

```bash
bun run build
bun run start
```

## API Endpoints

### Health Check

| Method | Endpoint | Description      |
| ------ | -------- | ---------------- |
| GET    | `/`      | API health check |

## Scripts

| Script                | Description                      |
| --------------------- | -------------------------------- |
| `bun run dev`         | Start dev server with hot reload |
| `bun run build`       | Build for production             |
| `bun run start`       | Start production server          |
| `bun run db:generate` | Generate Drizzle migrations      |
| `bun run db:migrate`  | Run Drizzle migrations           |
| `bun run db:push`     | Push schema directly to DB       |
| `bun run db:studio`   | Open Drizzle Studio              |
