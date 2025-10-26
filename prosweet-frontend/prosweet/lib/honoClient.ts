const API_URL = process.env.API_URL || "https://155.138.197.46:3002"
const AUTH = process.env.CALDAV_AUTH || "Basic dGVzdDp0ZXN0"; // "Basic base64(username:password)"

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: AUTH,
      ...options?.headers,
    },
    ...options,
  });
  if (!res.ok) throw new Error((await res.json()).error || res.statusText);
  return res.json();
}

export const getAllEvents = async () =>
  api<{ events: any[] }>("/events?all=true");


export const getEventsRange = async (start: Date, end: Date) =>
  api<{ events: any[] }>(
    `/events?start=${start.toISOString()}&end=${end.toISOString()}`
  );

export const getEventsByDay = async (day: Date) => {
  const start = new Date(day);
  const end = new Date(day);
  end.setDate(end.getDate() + 1);
  return getEventsRange(start, end);
};

export const createEvent = (data: {
  summary: string;
  start: string;
  end: string;
  description?: string;
}) =>
  api<{ created: any }>("/events", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const deleteEvent = (uid: string) =>
  api(`/events/${uid}`, { method: "DELETE" });
