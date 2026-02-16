import { Hono } from "hono";
import { db, secondaryDb } from "../db/index";
import { users } from "../db/schema/index";
import { event } from "../db/schema/secondary";
import { eq } from "drizzle-orm";

const eventRoute = new Hono();

// GET /event - List all events from secondary database
eventRoute.get("/", async (c) => {
  const allEvents = await secondaryDb.select().from(event);
  return c.json({ data: allEvents });
});

// GET /event/:id - Get a single event from secondary database
eventRoute.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [foundEvent] = await secondaryDb
    .select()
    .from(event)
    .where(eq(event.id, id));

  if (!foundEvent) {
    return c.json({ error: "Event not found" }, 404);
  }

  return c.json({ data: foundEvent });
});

// GET /event/:id/with-users - Example: query from BOTH databases
eventRoute.get("/:id/with-users", async (c) => {
  const id = c.req.param("id");

  // Query event from secondary database
  const [foundEvent] = await secondaryDb
    .select()
    .from(event)
    .where(eq(event.id, id));

  if (!foundEvent) {
    return c.json({ error: "Event not found" }, 404);
  }

  // Query users from main database
  const allUsers = await db.select().from(users);

  return c.json({
    data: {
      event: foundEvent,
      users: allUsers,
    },
  });
});

export default eventRoute;
