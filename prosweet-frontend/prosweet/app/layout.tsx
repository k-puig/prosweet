import "./globals.css";
import Navbar from "./components/Navbar";
import { AlarmProvider } from './components/AlarmProvider';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
                <AlarmProvider>
                  
        <Navbar />
          {children}
        </AlarmProvider>

        
      </body>
    </html>
  );
}
