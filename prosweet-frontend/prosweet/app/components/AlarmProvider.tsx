"use client";

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";

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

const getAllEvents = async () => api<{ events: any[] }>("/events?all=true");

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

interface AlarmContextType {
  refreshAlarms: () => void;
}

const AlarmContext = createContext<AlarmContextType | null>(null);

export function useAlarms() {
  const context = useContext(AlarmContext);
  if (!context) {
    throw new Error("useAlarms must be used within AlarmProvider");
  }
  return context;
}

export function AlarmProvider({ children }: { children: ReactNode }) {
  const [alarms, setAlarms] = useState<EventType[]>([]);
  const [activeAlarm, setActiveAlarm] = useState<EventType | null>(null);
  const triggeredAlarms = useRef(new Set<string>());

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Load alarms
  async function loadAlarms() {
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
    }
  }

  // Initial load
  useEffect(() => {
    loadAlarms();
  }, []);

  // Check for triggered alarms every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();

      alarms.forEach((ev) => {
        if (triggeredAlarms.current.has(ev.uid)) return;

        const eventTime = new Date(ev.start);
        const alarmTrigger = ev.alarms?.[0]?.trigger ?? "-PT0M";
        const triggerMs = parseCalDAVTrigger(alarmTrigger);
        const alarmTime = new Date(eventTime.getTime() + triggerMs);

        if (now >= alarmTime) {
          triggeredAlarms.current.add(ev.uid);
          setActiveAlarm(ev);

          // Browser notification
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(ev.summary, {
              body: `Event at ${eventTime.toLocaleTimeString()}`,
              icon: "🔔",
              tag: ev.uid,
            });
          }

          // Play sound
          const audio = new Audio(
            "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE="
          );
          audio.play().catch(() => {});
        }
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [alarms]);

  function dismissPopup() {
    setActiveAlarm(null);
  }

  function snoozeAlarm(minutes: number) {
    if (!activeAlarm) return;

    const newAlarmTime = new Date(Date.now() + minutes * 60000);
    const newStart = new Date(newAlarmTime.getTime() + 30 * 60000);

    createEvent({
      summary: `⏰ ${activeAlarm.summary} (Snoozed)`,
      start: newStart.toISOString(),
      end: new Date(newStart.getTime() + 30 * 60000).toISOString(),
      alarms: [{ action: "DISPLAY", trigger: "-PT0M" }],
    });

    setActiveAlarm(null);
    loadAlarms();
  }

  return (
    <AlarmContext.Provider value={{ refreshAlarms: loadAlarms }}>
      {children}

      {/* Global Popup Modal */}
      {activeAlarm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full mx-4">
            <div className="text-center">
              <div className="text-6xl mb-4">🔔</div>
              <h2 className="text-2xl font-bold mb-2 text-gray-800">
                {activeAlarm.summary}
              </h2>
              <p className="text-gray-600 mb-6">
                Event time: {new Date(activeAlarm.start).toLocaleString()}
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={dismissPopup}
                  className="w-full px-6 py-3 bg-pink-500 text-white rounded-lg font-semibold hover:bg-pink-600 transition"
                >
                  Dismiss
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => snoozeAlarm(5)}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm"
                  >
                    Snooze 5min
                  </button>
                  <button
                    onClick={() => snoozeAlarm(10)}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm"
                  >
                    Snooze 10min
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AlarmContext.Provider>
  );
}