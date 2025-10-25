"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function Calendar() {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Example: static month layout
  const days = Array.from({ length: 30 }, (_, i) => i + 1);

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-semibold mb-6 text-center">October 2025</h2>

      <div className="grid grid-cols-7 gap-3 text-center">
        {days.map((day) => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className="aspect-square flex items-center justify-center rounded-xl border border-gray-300 hover:bg-gray-100 transition"
          >
            {day}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {selectedDay && (
          <>
            {/* Overlay */}
            <motion.div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDay(null)}
            />

            {/* Popup */}
            <motion.div
              className="fixed z-50 inset-0 flex items-center justify-center"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
            >
              <div className="bg-white rounded-2xl shadow-xl p-6 w-96">
                <h3 className="text-xl font-semibold mb-3">
                  Events for October {selectedDay}
                </h3>
                <p className="text-gray-600 text-sm">
                  No events yet. You can add event logic here later.
                </p>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition"
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
