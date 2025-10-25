export default function CalendarPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="px-8 py-4 border-b bg-white shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">Calendar</h1>
        <p className="text-gray-500 text-sm mt-1">
          View upcoming events and important dates.
        </p>
      </header>

      {/* Main content */}
      <main className="flex-1 flex justify-center items-center">
        <div className="text-center">
          <p className="text-lg text-gray-600">
            📅 Your calendar will appear here soon.
          </p>
        </div>
      </main>
    </div>
  );
}
