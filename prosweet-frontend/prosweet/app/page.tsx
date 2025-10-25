import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Navbar */}
      <header className="flex justify-between items-center px-8 py-4 bg-white shadow-sm">
        <div className="flex space-x-2">
          <Link href="#" className="px-3 py-1 bg-gray-100 rounded-md text-sm font-medium">
            Calendar
          </Link>
          <Link href="#" className="px-3 py-1 bg-gray-100 rounded-md text-sm font-medium">
            Alarm
          </Link>
         
        </div>
        <div className="space-x-2">
          <Link
            href="#"
            className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-100"
          >
            Sign in
          </Link>
          <Link
            href="#"
            className="px-3 py-1 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800"
          >
            Register
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col justify-center items-center text-center px-6">
        <h1 className="text-6xl font-bold">ProSweet</h1>
        <p className="mt-2 text-xl italic text-gray-500">sweet like sugar</p>
        <div className="mt-6 flex space-x-3">
          <Link
            href="#"
            className="px-5 py-2 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-100"
          >
            Try Now
          </Link>
          <Link
            href="#"
            className="px-5 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800"
          >
            Register
          </Link>
        </div>
      </main>
    </div>
  );
}
