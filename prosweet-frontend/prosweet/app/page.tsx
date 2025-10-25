import Link from "next/link";
// import ChatMenu from "./components/ChatMenu";
// import ChatButton from "./components/ChatButton";
// import ChatMessage from "./components/ChatMessage";
// import TextInput from "./components/TextInput";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center">
      <h1 className="text-6xl font-bold">ProSweet</h1>
      <p className="mt-2 text-xl italic text-gray-500">sweet like sugar</p>
      <div className="mt-6 flex space-x-3">
        <Link href="/calendar">
        <button className="px-5 py-2 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-100">
          Try Now
        </button>
        </Link>

        <button className="px-5 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800">
        Something
        </button>
        


      </div>
    </div>
  );
}
