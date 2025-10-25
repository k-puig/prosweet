
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = ["Item", "Item", "Item", "Item", "Item", "Item"];

  return (
    <nav className="w-full bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto flex justify-between items-center px-6 py-4">
        {/* Left side: Nav links */}
        <div className="flex items-center gap-2">
          <Link
            href="/calendar"
            className={`px-3 py-1 rounded-md text-sm font-medium ${
              pathname === "/calendar"
                ? "bg-gray-100 text-gray-900"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
          >
            Calendar
          </Link>
          {navItems.map((item, index) => (
            <Link
              key={index}
              href="#"
              className="px-3 py-1 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              {item}
            </Link>
          ))}
        </div>

        {/* Right side: Auth buttons */}
        <div className="flex items-center gap-2">
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

        {/* Mobile menu toggle */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden ml-3 p-2 border rounded-lg hover:bg-gray-100"
          aria-label="Toggle menu"
        >
          ☰
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="flex flex-col md:hidden border-t bg-white px-6 py-3 space-y-2">
          <Link href="/calendar" className="text-gray-700 hover:text-gray-900">
            Calendar
          </Link>
          {navItems.map((item, i) => (
            <Link
              key={i}
              href="#"
              className="text-gray-700 hover:text-gray-900"
            >
              {item}
            </Link>
          ))}
          <div className="flex gap-2 pt-2">
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
        </div>
      )}
    </nav>
  );
}
