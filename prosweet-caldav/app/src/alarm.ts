// alarms.ts
import { listEvents } from "./caldav";

/**
 * Parse iCalendar durations like -PT10M, PT30S, -P1D, P2W → milliseconds.
 */
function parseIcsDurationToMs(s: string): number | null {
  const m = s.toUpperCase().match(
    /^(-)?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/
  );
  if (!m) return null;
  const sign = m[1] ? -1 : 1;
  const weeks = parseInt(m[2] || "0", 10);
  const days = parseInt(m[3] || "0", 10);
  const hours = parseInt(m[4] || "0", 10);
  const mins = parseInt(m[5] || "0", 10);
  const secs = parseInt(m[6] || "0", 10);
  const ms = (((weeks * 7 + days) * 24 + hours) * 60 + mins) * 60 * 1000 + secs * 1000;
  return sign * ms;
}

function isIsoUtc(s: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(s);
}

/**
 * Returns an array of UNIX timestamps (ms since epoch) for all alarms in range.
 */
export async function getAlarmTimestamps(
  authHeader: string,
  fromISO?: string,
  toISO?: string
): Promise<number[]> {
  const now = new Date();
  const from = fromISO ? new Date(fromISO) : now;
  const to = toISO ? new Date(toISO) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const events: any[] = await listEvents(authHeader, {
    start: from.toISOString(),
    end: to.toISOString(),
  });

  const timestamps: number[] = [];

  for (const ev of events) {
    const start = new Date(ev.start);
    const alarms = Array.isArray(ev.alarms) ? ev.alarms : [];
    for (const a of alarms) {
      let fire: Date | null = null;
      if (isIsoUtc(a.trigger)) {
        fire = new Date(a.trigger);
      } else {
        const ms = parseIcsDurationToMs(a.trigger);
        if (ms !== null) fire = new Date(start.getTime() + ms);
      }
      if (fire && fire >= from && fire <= to) {
        timestamps.push(fire.getTime()); // <-- UNIX timestamp (ms)
      }
    }
  }

  timestamps.sort((a, b) => a - b);
  return timestamps;
}

