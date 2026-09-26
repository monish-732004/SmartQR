import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SmartPlug QR",
  description: "Find working, available library charging points.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gradient-to-b from-violet-50 via-white to-white text-neutral-900">
        <NavBar />
        <main className="animate-fade-in mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24 sm:pb-6">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
