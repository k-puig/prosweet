const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const AUTH = process.env.NEXT_PUBLIC_CALDAV_AUTH || ""; // "Basic base64(username:password)"

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
