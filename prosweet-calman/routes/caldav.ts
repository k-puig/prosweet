// caldav.ts
import { CalDAVClient } from "ts-caldav";

const CALDAV_BASE_URL = "http://localhost:5232/";

if (!CALDAV_BASE_URL) {
  throw new Error(
    "Missing CALDAV_* env. Set CALDAV_BASE_URL, CALDAV_USERNAME, CALDAV_PASSWORD"
  );
}

let clientPromise: Promise<CalDAVClient> | null = null;

async function getClient(auth) {
  if (!auth) return c.json({ error: "Missing Authorization header" }, 401);

  if (!auth.startsWith("Basic ")) {
    return c.json({ error: "Invalid Authorization scheme" }, 401);
  }

  // Decode the Base64 part
  const base64Credentials = auth.split(" ")[1];
  const decoded = Buffer.from(base64Credentials, "base64").toString("utf8");

  // decoded is "username:password"
  const [username, password] = decoded.split(":");

  if (!username || !password) {
    throw new Error("Malformed Basic Auth credentials");
  }

  if (!clientPromise) {
    clientPromise = CalDAVClient.create({
      baseUrl: CALDAV_BASE_URL,
      auth: {
        type: "basic",
        username,
        password,
      },
      // For debugging:
      // logRequests: true,
    });
  }
  return clientPromise;
}

export type ListEventsOptions = {
  start?: string; // ISO
  end?: string;   // ISO
  all?: boolean;
};

export async function listCalendars(auth: string) {
  const client = await getClient(auth);
  // Each calendar has fields like: url, displayName, ctag, components, etc.
  const calendars = await client.getCalendars();
  return calendars.map((c: any) => ({
    url: c.url,
    displayName: c.displayName ?? c.url,
    components: c.components,
    ctag: c.ctag,
  }));
}

export async function listEvents(
  auth: string,
  calendarUrl: string,
  { start, end, all }: ListEventsOptions = {}
) {
  const client = await getClient(auth);
  const range =
    all
      ? { all: true }
      : {
        start: start ? new Date(start) : undefined,
        end: end ? new Date(end) : undefined,
      };

  const events = await client.getEvents(calendarUrl, range as any);
  return events;
}

export type CreateEventInput = {
  calendarUrl: string;
  // Minimal fields
  summary: string;
  start: string; // ISO
  end: string;   // ISO
  // Optional nice-to-haves supported by ts-caldav:
  startTzid?: string;
  endTzid?: string;
  description?: string;
  location?: string;
  uid?: string;
  // Optional VALARM(s)
  alarms?: Array<
    | { action: "DISPLAY"; trigger: string; description?: string }
    | { action: "AUDIO"; trigger: string }
    | {
      action: "EMAIL";
      trigger: string;
      summary?: string;
      description?: string;
      attendees?: string[];
    }
  >;
  // Recurrence (RRULE) is supported; pass-through as raw string if you use it.
  rrule?: string;
  allDay?: boolean;
};

export async function createEvent(auth: string, input: CreateEventInput) {
  const client = await getClient(auth);

  const {
    calendarUrl,
    summary,
    start,
    end,
    startTzid,
    endTzid,
    description,
    location,
    uid,
    alarms,
    rrule,
    allDay,
  } = input;

  const created = await client.createEvent(calendarUrl, {
    summary,
    start: new Date(start),
    end: new Date(end),
    startTzid,
    endTzid,
    description,
    location,
    uid,
    alarms,
    rrule,
    allDay,
  } as any);

  return created; // typically includes href/etag/uid
}

export async function deleteEvent(auth: string, calendarUrl: string, uid: string, etag?: string) {
  const client = await getClient(auth);
  // Many servers allow delete with just UID; some prefer ETag for safe delete
  const res = await client.deleteEvent(calendarUrl, uid, etag);
  return { ok: true, result: res };
}
