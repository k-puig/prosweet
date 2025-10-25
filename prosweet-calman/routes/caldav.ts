// caldav.ts
import { CalDAVClient } from "ts-caldav";

/**
 * Environment:
 *  - CALDAV_BASE_URL  e.g. http://localhost:5232/USERNAME/
 *  - CALDAV_USERNAME
 *  - CALDAV_PASSWORD
 */
const CALDAV_BASE_URL = "http://localhost:5232/";
const CALDAV_USERNAME = "test";
const CALDAV_PASSWORD = "test";

if (!CALDAV_BASE_URL || !CALDAV_USERNAME || !CALDAV_PASSWORD) {
  throw new Error(
    "Missing CALDAV_* env. Set CALDAV_BASE_URL, CALDAV_USERNAME, CALDAV_PASSWORD"
  );
}

let clientPromise: Promise<CalDAVClient> | null = null;

async function getClient() {
  if (!clientPromise) {
    clientPromise = CalDAVClient.create({
      baseUrl: CALDAV_BASE_URL,
      auth: {
        type: "basic",
        username: CALDAV_USERNAME,
        password: CALDAV_PASSWORD,
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

export async function listCalendars() {
  const client = await getClient();
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
  calendarUrl: string,
  { start, end, all }: ListEventsOptions = {}
) {
  const client = await getClient();
  const range =
    all
      ? { all: true }
      : {
        start: start ? new Date(start) : undefined,
        end: end ? new Date(end) : undefined,
      };

  const events = await client.getEvents(calendarUrl, range as any);
  // Events are already parsed to structured objects by ts-caldav.
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

export async function createEvent(input: CreateEventInput) {
  const client = await getClient();

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

export async function deleteEvent(calendarUrl: string, uid: string, etag?: string) {
  const client = await getClient();
  // Many servers allow delete with just UID; some prefer ETag for safe delete
  const res = await client.deleteEvent(calendarUrl, uid, etag);
  return { ok: true, result: res };
}
