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
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and update the values:

```bash
cp .env.example .env
```

| Variable                 | Description                  | Default                                                         |
| ------------------------ | ---------------------------- | --------------------------------------------------------------- |
| `DATABASE_URL`           | PostgreSQL connection string | `postgresql://user:password@localhost:5432/truekhmer`           |
| `SECONDARY_DATABASE_URL` | PostgreSQL connection string | `postgresql://user:password@localhost:5432/truekhmer_secondary` |
| `PORT`                   | Server port                  | `3000`                                                          |

### Database Setup

Push the schema to your database:

```bash
npm run db:push
```

Or generate and run migrations:

```bash
npm run db:generate
npm run db:migrate
```

### Development

```bash
npm run dev
```

The server will start at `http://localhost:3000`.

### Production

```bash
npm run build
npm start
```

## API Endpoints

### Health Check

| Method | Endpoint | Description      |
| ------ | -------- | ---------------- |
| GET    | `/`      | API health check |

## Scripts

| Script                | Description                      |
| --------------------- | -------------------------------- |
| `npm run dev`         | Start dev server with hot reload |
| `npm run build`       | Build for production             |
| `npm start`           | Start production server          |
| `npm run db:generate` | Generate Drizzle migrations      |
| `npm run db:migrate`  | Run Drizzle migrations           |
| `npm run db:push`     | Push schema directly to DB       |
| `npm run db:studio`   | Open Drizzle Studio              |
