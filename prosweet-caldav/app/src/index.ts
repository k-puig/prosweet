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
import { getAlarmTimestamps } from "./alarm";

const app = new Hono();

// CORS for local dev tools / frontends
app.use(
  "/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "DELETE"],
    allowHeaders: ["Content-Type", "If-Match", "Authorization"],
    maxAge: 86400,
  })
);

app.get("/health", (c) => c.json({ ok: true }));

/**
 * GET /calendars
 * Lists available calendars discovered for the authenticated principal.
 */
app.get("/calendars", async (c) => {
  try {
    const auth: string = c.req.header("Authorization");
    const calendars = await listCalendars(auth);
    return c.json(calendars);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 401);
  }
});

/**
 * GET /events?calendarUrl=<...>&start=<ISO>&end=<ISO>&all=true|false
 * Lists events from a given calendar. Prefer calendarUrl from /calendars.
 * If `all=true` is set, ts-caldav will fetch all events (may be heavy).
 */
app.get("/events", async (c) => {
  try {
    const auth: any = c.req.header("Authorization");
    const opts: ListEventsOptions = {
      start: c.req.query("start") ?? undefined,
      end: c.req.query("end") ?? undefined,
      all: c.req.query("all") === "true" ? true : undefined,
    };
    const events = await listEvents(auth, opts);
    return c.json({ events });
  } catch (err) {
    const status = err instanceof HTTPException ? err.status : 401;
    return c.json({ error: (err as Error).message }, status);
  }
});

app.get("/alarms", async (c) => {
  try {
    const auth = c.req.header("Authorization");
    if (!auth) return c.json({ error: "Missing Authorization header" }, 401);

    const from = c.req.query("from") ?? undefined;
    const to = c.req.query("to") ?? undefined;

    const timestamps = await getAlarmTimestamps(auth, from, to);
    return c.json({ alarms: timestamps });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
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
  try {
    const auth: string = c.req.header("Authorization") || "";
    const body = await c.req.json();
    if (!body?.summary || !body?.start || !body?.end) {
      throw new HTTPException(400, {
        message:
          "Required: summary, start(ISO), end(ISO). Optional: startTzid, endTzid, description, location, uid, alarms, rrule, allDay",
      });
    }
    const created = await createEvent(auth, body);
    return c.json({ created });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 401);
  }
});

/**
 * DELETE /events/:uid?calendarUrl=<...>&etag=<optional>
 * Deletes an event by UID. If you store ETags, pass ?etag= to ensure safe delete.
 */
app.delete("/events/:uid", async (c) => {
  try {
    const auth = c.req.header("Authorization");
    const uid = c.req.param("uid");
    const etag = c.req.query("etag") ?? undefined;

    if (!auth) return c.json({ error: "Missing Authorization header" }, 401);
    if (!uid) return c.json({ error: "Missing :uid" }, 400);

    const result = await deleteEvent(auth, uid, etag);
    return c.json(result);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 401);
  }
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
  port: Number(process.env.PORT ?? 3001),
  fetch: app.fetch,
};
