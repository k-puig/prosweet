// server.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import {
  listCalendars,
  listEvents,
  createEvent,
  deleteEvent,
  type ListEventsOptions,
} from "./caldav";

const app = new Hono();

// CORS for local dev tools / frontends
app.use(
  "/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "DELETE", "PUT", "OPTIONS"],
    allowHeaders: ["Content-Type", "If-Match"],
    maxAge: 86400,
  })
);

app.get("/health", (c) => c.json({ ok: true }));

/**
 * GET /calendars
 * Lists available calendars discovered for the authenticated principal.
 */
app.get("/calendars", async (c) => {
  const data = await listCalendars();
  return c.json({ calendars: data });
});

/**
 * GET /events?calendarUrl=<...>&start=<ISO>&end=<ISO>&all=true|false
 * Lists events from a given calendar. Prefer calendarUrl from /calendars.
 * If `all=true` is set, ts-caldav will fetch all events (may be heavy).
 */
app.get("/events", async (c) => {
  const calendarUrl = c.req.query("calendarUrl");
  if (!calendarUrl) {
    throw new HTTPException(400, { message: "Missing ?calendarUrl" });
  }
  const opts: ListEventsOptions = {
    start: c.req.query("start") ?? undefined,
    end: c.req.query("end") ?? undefined,
    all: c.req.query("all") === "true" ? true : undefined,
  };
  const events = await listEvents(calendarUrl, opts);
  return c.json({ events });
});

/**
 * POST /events
 * Body: {
 *   calendarUrl: string,
 *   summary: string,
 *   start: string(ISO),
 *   end: string(ISO),
 *   startTzid?: string, endTzid?: string, description?: string, location?: string,
 *   uid?: string, alarms?: [...], rrule?: string, allDay?: boolean
 * }
 */
app.post("/events", async (c) => {
  const body = await c.req.json();
  if (!body?.calendarUrl || !body?.summary || !body?.start || !body?.end) {
    throw new HTTPException(400, {
      message:
        "Required: calendarUrl, summary, start(ISO), end(ISO). Optional: startTzid, endTzid, description, location, uid, alarms, rrule, allDay",
    });
  }
  const created = await createEvent(body);
  return c.json({ created });
});

/**
 * DELETE /events/:uid?calendarUrl=<...>&etag=<optional>
 * Deletes an event by UID. If you store ETags, pass ?etag= to ensure safe delete.
 */
app.delete("/events/:uid", async (c) => {
  const uid = c.req.param("uid");
  const calendarUrl = c.req.query("calendarUrl");
  const etag = c.req.query("etag") ?? undefined;

  if (!calendarUrl || !uid) {
    throw new HTTPException(400, {
      message: "Missing ?calendarUrl or :uid",
    });
  }

  const result = await deleteEvent(calendarUrl, uid, etag);
  return c.json(result);
});

// Global error handler
app.onError((err, c) => {
  console.error(err);
  const status =
    err instanceof HTTPException ? err.status : 500;
  const message =
    err instanceof HTTPException ? err.message : "Internal Server Error";
  return c.json({ error: message }, status);
});

// Bun entrypoint
export default {
  port: Number(process.env.PORT ?? 3000),
  fetch: app.fetch,
};