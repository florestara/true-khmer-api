import { Hono } from "hono";
import { secondaryDb } from "../db/index";
import { event } from "../db/schema/secondary";
import { eq, and } from "drizzle-orm";

const eventRoute = new Hono();

// GET /event - List all events from secondary database
eventRoute.get("/", async (c) => {
  const allEvents = await secondaryDb
    .select()
    .from(event)
    .where(and(eq(event.visibility, "LISTED"), eq(event.status, "PUBLISHED")));

  return c.json({
    data: allEvents,
  });
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

export default eventRoute;
