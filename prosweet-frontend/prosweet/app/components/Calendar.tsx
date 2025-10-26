"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getEventsRange,
  getEventsByDay,
  createEvent,
  deleteEvent,
} from "@/lib/honoClient";

export default function Calendar() {
  const [events, setEvents] = useState<Record<string, any[]>>({});
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [modalEvents, setModalEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // 🔹 Month & Year selection
  const current = new Date();
  const [month, setMonth] = useState(current.getMonth());
  const [year, setYear] = useState(current.getFullYear());

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const days = Array.from({ length: monthEnd.getDate() }, (_, i) => i + 1);

  //  Fetch events for current month
  async function loadEvents() {
    setLoading(true);
    try {
      const data = await getEventsRange(monthStart, monthEnd);
      const grouped: Record<string, any[]> = {};
      for (const ev of data.events) {
        const d = new Date(ev.start).toISOString().split("T")[0];
        grouped[d] = grouped[d] || [];
        grouped[d].push(ev);
      }
      setEvents(grouped);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
  }, [month, year]); // re-fetch when month or year changes

  // Optional: auto-refresh every 15s
  useEffect(() => {
    const interval = setInterval(() => {
      loadEvents();
      if (selectedDate) updateModal(selectedDate);
    }, 15000);
    return () => clearInterval(interval);
  }, [selectedDate, month, year]);

  async function updateModal(date: Date) {
    const data = await getEventsByDay(date);
    setModalEvents(data.events || []);
  }

  async function openDay(day: number) {
    const date = new Date(year, month, day);
    setSelectedDate(date);
    await updateModal(date);
  }

  async function handleAddEvent(summary: string) {
    if (!selectedDate) return;
    const start = new Date(selectedDate);
    const end = new Date(selectedDate);
    end.setHours(start.getHours() + 1);

    await createEvent({
      summary,
      start: start.toISOString(),
      end: end.toISOString(),
    });

    await updateModal(selectedDate);
    await loadEvents();
  }

  async function handleDelete(uid: string) {
    await deleteEvent(uid);
    if (selectedDate) {
      await updateModal(selectedDate);
      await loadEvents();
    }
  }

  // 🗓 Month and year options
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const years = Array.from({ length: 10 }, (_, i) => current.getFullYear() - 5 + i);

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      {/* 🔽 Month & Year Selectors */}
      <div className="flex justify-center items-center gap-3 mb-6">
        <select
          value={month}
          onChange={(e) => setMonth(parseInt(e.target.value))}
          className="border rounded-md px-3 py-1 text-sm bg-white shadow-sm"
        >
          {months.map((m, i) => (
            <option key={i} value={i}>
              {m}
            </option>
          ))}
        </select>

        <select
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value))}
          className="border rounded-md px-3 py-1 text-sm bg-white shadow-sm"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <h2 className="text-3xl font-semibold text-center mb-4">
        {months[month]} {year}
      </h2>

      {loading ? (
        <p className="text-center">Loading events...</p>
      ) : (
        <div className="grid grid-cols-7 gap-2 text-center">
          {days.map((day) => {
            const dateKey = new Date(year, month, day).toISOString().split("T")[0];
            const dayEvents = events[dateKey] || [];
            return (
              <button
                key={day}
                onClick={() => openDay(day)}
                className={`aspect-square flex flex-col items-center justify-center rounded-lg border hover:bg-gray-100 ${
                  dayEvents.length ? "border-teal-400" : "border-gray-300"
                }`}
              >
                <span className="font-medium">{day}</span>
                {dayEvents.length > 0 && (
                  <span className="text-xs text-pink-500 mt-1">
                    {dayEvents.length} event{dayEvents.length > 1 ? "s" : ""}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 🔹 Popout modal */}
      <AnimatePresence>
        {selectedDate && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/40 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDate(null)}
            />
            <motion.div
              className="fixed inset-0 flex items-center justify-center z-50"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="bg-white rounded-2xl shadow-xl p-6 w-96 relative">
                <h3 className="text-xl font-semibold mb-4 text-center">
                  Events for {selectedDate.toDateString()}
                </h3>

                {modalEvents.length ? (
                  <ul className="space-y-2 mb-4">
                    {modalEvents.map((ev) => (
                      <li
                        key={ev.uid}
                        className="border p-2 rounded flex justify-between items-center"
                      >
                        <span>{ev.summary}</span>
                        <button
                          onClick={() => handleDelete(ev.uid)}
                          className="text-red-500 text-sm hover:underline"
                        >
                          Delete
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 text-sm mb-4">No events for this day.</p>
                )}

                <AddEventForm onAdd={handleAddEvent} />

                <button
                  onClick={() => setSelectedDate(null)}
                  className="mt-4 w-full py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function AddEventForm({ onAdd }: { onAdd: (summary: string) => void }) {
  const [summary, setSummary] = useState("");
  return (
    <div className="flex gap-2">
      <input
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="New event..."
        className="border rounded-md flex-1 px-2 py-1 text-sm"
      />
      <button
        onClick={() => {
          if (summary.trim()) {
            onAdd(summary);
            setSummary("");
          }
        }}
        className="px-3 py-1 bg-green-500 text-white rounded-md text-sm"
      >
        Add
      </button>
    </div>
  );
}
