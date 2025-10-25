// caldav.ts
import { CalDAVClient } from "ts-caldav";

const CALDAV_BASE_URL = "http://localhost:5232/";

if (!CALDAV_BASE_URL) {
  throw new Error(
    "Missing CALDAV_* env. Set CALDAV_BASE_URL, CALDAV_USERNAME, CALDAV_PASSWORD"
  );
}

let clientPromise: Promise<CalDAVClient> | null = null;

async function getClient(auth: string) {
  if (!auth) {
    return { error: "Missing Authorization header", status: 401 };
  }

  // Wrong scheme
  if (!auth.startsWith("Basic ")) {
    return { error: "Invalid Authorization scheme", status: 401 };
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

export async function listCalendars(authHeader?: string) {
  const client = await getClient(authHeader);
  const calendars = await client.getCalendars();

  // Return just the URLs, trimmed of leading/trailing slashes
  return calendars.map((c: any) =>
    c.url.replace(/^\/|\/$/g, "")
  );
}

export async function listEvents(
  authHeader: string,
  { start, end, all }: ListEventsOptions = {}
) {
  const client = await getClient(authHeader);

  const calendars = await client.getCalendars();
  if (!calendars || calendars.length === 0) {
    throw new Error("No calendars found for this user");
  }
  // Use the first calendar exactly as returned (Radicale wants the trailing /)
  const calendarUrl = calendars[0].url;

  // Validate dates when provided
  const toDate = (s?: string) => (s ? new Date(s) : undefined);
  const startDate = toDate(start);
  const endDate = toDate(end);
  if (start && isNaN(startDate!.getTime())) throw new Error("Invalid start ISO datetime");
  if (end && isNaN(endDate!.getTime())) throw new Error("Invalid end ISO datetime");

  // Build half-open range per your rule
  // - only start  => after start
  // - only end    => before end
  // - both        => between
  // - neither     => all (or choose your own default)
  const range =
    all || (!start && !end)
      ? { all: true }
      : start && !end
        ? { start: startDate }
        : !start && end
          ? { end: endDate }
          : { start: startDate, end: endDate };

  return client.getEvents(calendarUrl, range as any);
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

  const calendars = await client.getCalendars();
  if (!calendars || calendars.length === 0) {
    throw new Error("No calendars found for this user");
  }

  const calendarUrl = calendars[0].url;

  if (!calendarUrl) {
    throw new Error("Missing calendar URL");
  }

  const {
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

export async function deleteEvent(authHeader: string, uidOrHref: string, etag?: string) {
  const client = await getClient(authHeader);
  const calendars = await client.getCalendars();
  if (!calendars?.length) throw new Error("No calendars found for this user");

  const calendarUrl = calendars[0].url; // keep exact (with trailing /)

  // Build href/uid
  const href = uidOrHref.startsWith("/") || uidOrHref.endsWith(".ics")
    ? uidOrHref
    : `${calendarUrl}${uidOrHref}.ics`;
  const uid = href.split("/").pop()!.replace(/\.ics$/i, "");

  // Helper: extract HTTP status defensively
  const getStatus = (e: any): number | undefined => {
    if (e?.response?.status) return e.response.status;
    if (typeof e?.status === "number") return e.status;
    const m = typeof e?.message === "string" && e.message.match(/\bstatus(?:\s+code)?\s+(\d{3})\b/i);
    if (m) return parseInt(m[1], 10);
    return undefined;
  };

  try {
    // Preferred path: use library delete (by uid)
    const res = await client.deleteEvent(calendarUrl, uid, etag);
    // If it returns, consider it success
    return { ok: true, status: 204, result: res };
  } catch (e: any) {
    const status = getStatus(e);

    // Normalize common server responses
    if (status === 200 || status === 204) {
      return { ok: true, status, note: "Normalized DELETE success (server returned 200/204)" };
    }

    // If 404, it's already gone
    if (status === 404) {
      return { ok: false, status: 404, error: "Event not found" };
    }

    // Fallback: verify by checking if the UID still exists
    try {
      const events = await client.getEvents(calendarUrl, { all: true } as any);
      const stillThere = Array.isArray(events) && events.some((ev: any) => ev?.uid === uid);
      if (!stillThere) {
        return { ok: true, status: 204, note: "Verified deletion by absence after error" };
      }
    } catch {
      // ignore verification failure, proceed to throw below
    }

    // Last resort: bubble up with more detail
    const msg = typeof e?.message === "string" ? e.message : String(e);
    throw new Error(`Failed to delete event (status ${status ?? "unknown"}): ${msg}`);
  }
}

