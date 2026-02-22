import { Hono } from "hono";
import { secondaryDb } from "../db/index";
import { event, venue, ticketTier } from "../db/schema/secondary";
import { eq, and, getTableColumns, min, sql } from "drizzle-orm";

const eventRoute = new Hono();

// GET /event - List all events from secondary database
eventRoute.get("/", async (c) => {
  const ticketSubquery = secondaryDb
    .select({
      eventId: ticketTier.eventId,
      minBasePrice: min(ticketTier.basePrice).as("min_base_price"),
    })
    .from(ticketTier)
    .where(and(eq(ticketTier.isActive, true), eq(ticketTier.isVisible, true)))
    .groupBy(ticketTier.eventId)
    .as("t");

  const allEvents = await secondaryDb
    .select({
      ...getTableColumns(event),
      city: venue.city,
      minBasePrice: ticketSubquery.minBasePrice,
    })
    .from(event)
    .leftJoin(ticketSubquery, eq(ticketSubquery.eventId, event.id))
    .leftJoin(venue, eq(venue.id, event.venueId))
    .where(and(eq(event.visibility, "LISTED"), eq(event.status, "PUBLISHED")));

  return c.json({
    data: allEvents.map((v) => ({
      title: v.title,
      slug: v.slug,
      startDate: v.startAt,
      endDate: v.endAt,
      venueId: v.venueId,
      cover: v.cover,
      excerpt: v.excerpt,
      city: v.city,
      ticketStatus: v.ticketStatus,
      isOnline: v.isOnline,
      basePrice: v.minBasePrice,
    })),
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
