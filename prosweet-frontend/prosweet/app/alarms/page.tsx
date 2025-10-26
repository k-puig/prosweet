"use client";

import { useEffect, useState } from "react";
import { useAlarms } from "../components/AlarmProvider"; // Import the provider hook

// API Client
const API_URL = "http://155.138.197.46:3002";
const AUTH = "Basic dGVzdDp0ZXN0";

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

const getAllEvents = async () =>
  api<{ events: any[] }>("/events?all=true");

const createEvent = (data: {
  summary: string;
  start: string;
  end: string;
  alarms?: Array<{ action: string; trigger: string }>;
}) =>
  api<{ created: any }>("/events", {
    method: "POST",
    body: JSON.stringify(data),
  });

const deleteEvent = (uid: string) =>
  api(`/events/${uid}`, { method: "DELETE" });

// Type definition
type EventType = {
  uid: string;
  summary: string;
  start: string;
  end: string;
  alarms?: Array<{ action: string; trigger: string }>;
};

// Utility to calculate the trigger time
function parseCalDAVTrigger(trigger: string) {
  const match = trigger.match(/(-)?PT(\d+)([MH])/);
  if (!match) return 0;
  const [, neg, value, unit] = match;
  const ms = unit === "H" ? +value * 3600000 : +value * 60000;
  return neg ? -ms : ms;
}

export default function AlarmsPage() {
  const [alarms, setAlarms] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(false);
  const { refreshAlarms } = useAlarms();

  // Form state
  const [summary, setSummary] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [trigger, setTrigger] = useState("0");

  // Load alarms
  async function loadAlarms() {
    setLoading(true);
    try {
      const data = await getAllEvents();
      const now = new Date();

      const upcoming = data.events.filter((ev: EventType) => {
        const start = new Date(ev.start);
        return ev.alarms?.length && start > now;
      });

      upcoming.sort((a, b) => +new Date(a.start) - +new Date(b.start));
      setAlarms(upcoming);
    } catch (err) {
      console.error("Failed to fetch alarms:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAlarms();
  }, []);

  // Add new alarm
  async function handleAddAlarm() {
    if (!summary || !date || !time) return alert("Please fill all fields.");

    const start = new Date(`${date}T${time}`);
    const end = new Date(start.getTime() + 30 * 60000);
    const triggerStr = `-PT${trigger}M`;

    await createEvent({
      summary,
      start: start.toISOString(),
      end: end.toISOString(),
      alarms: [{ action: "DISPLAY", trigger: triggerStr }],
    });

    setSummary("");
    setDate("");
    setTime("");
    setTrigger("0");
    
    await loadAlarms();
    refreshAlarms(); // Refresh the global alarm checker
  }

  async function handleDelete(uid: string) {
    await deleteEvent(uid);
    await loadAlarms();
    refreshAlarms(); // Refresh the global alarm checker
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-semibold mb-6 text-center">Upcoming Alarms</h1>

      {/* Create new alarm */}
      <div className="border rounded-lg p-4 mb-6 shadow-sm bg-white">
        <h2 className="font-medium mb-2">Add New Alarm</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Alarm name"
            className="border rounded-md px-2 py-1 text-sm"
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border rounded-md px-2 py-1 text-sm"
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="border rounded-md px-2 py-1 text-sm"
          />
          <div className="flex gap-2 items-center">
            <input
              type="number"
              value={trigger}
              min="0"
              onChange={(e) => setTrigger(e.target.value)}
              className="w-16 border rounded-md px-2 py-1 text-sm text-center"
            />
            <span className="text-sm text-gray-600">min before</span>
          </div>
        </div>
        <button
          onClick={handleAddAlarm}
          className="mt-3 px-4 py-2 bg-pink-500 text-white rounded-md text-sm hover:bg-pink-600"
        >
          Add Alarm
        </button>
      </div>

      {loading ? (
        <p className="text-center text-gray-500">Loading...</p>
      ) : alarms.length === 0 ? (
        <p className="text-center text-gray-500">No upcoming alarms 🎉</p>
      ) : (
        <ul className="space-y-3">
          {alarms.map((ev) => {
            const eventTime = new Date(ev.start);
            const alarmTrigger = ev.alarms?.[0]?.trigger ?? "-PT0M";
            const triggerMs = parseCalDAVTrigger(alarmTrigger);
            const alarmTime = new Date(eventTime.getTime() + triggerMs);

            return (
              <li
                key={ev.uid}
                className="border rounded-lg p-4 shadow-sm bg-white flex justify-between items-center"
              >
                <div>
                  <h2 className="font-medium text-lg">{ev.summary}</h2>
                  <p className="text-sm text-gray-500">
                    Event: {eventTime.toLocaleString()}
                  </p>
                  <p className="text-sm text-pink-600">
                    ⏰ Alarm: {alarmTime.toLocaleString()} (
                    {Math.abs(triggerMs / 60000)} min before)
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(ev.uid)}
                  className="text-red-500 hover:underline text-sm"
                >
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}