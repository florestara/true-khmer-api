import { Hono } from "hono";
import { db } from "../db/index";
import { users } from "../db/schema/index";
import { eq } from "drizzle-orm";

const usersRoute = new Hono();

// GET /users - List all users
usersRoute.get("/", async (c) => {
  const allUsers = await db.select().from(users);
  return c.json({ data: allUsers });
});

// GET /users/:id - Get a single user
usersRoute.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [user] = await db.select().from(users).where(eq(users.id, id));

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({ data: user });
});

// POST /users - Create a new user
usersRoute.post("/", async (c) => {
  const body = await c.req.json<{ name: string; email: string }>();

  const [newUser] = await db
    .insert(users)
    .values({
      name: body.name,
      email: body.email,
    })
    .returning();

  return c.json({ data: newUser }, 201);
});

// PUT /users/:id - Update a user
usersRoute.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ name?: string; email?: string }>();

  const [updatedUser] = await db
    .update(users)
    .set(body)
    .where(eq(users.id, id))
    .returning();

  if (!updatedUser) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({ data: updatedUser });
});

export default usersRoute;
