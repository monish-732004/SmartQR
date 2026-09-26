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
      <body className="min-h-full flex flex-col text-neutral-900">
        {/* Post-login background (public/background.jpg). Fixed layer (not background-attachment) so
            it also works on mobile browsers. */}
        <div
          aria-hidden
          className="fixed inset-0 -z-10 bg-cover bg-center"
          style={{
            backgroundImage:
              "url(/background.jpg)",
          }}
        />
        <NavBar />
        <main className="animate-fade-in mx-auto my-4 w-[calc(100%-1.5rem)] max-w-5xl flex-1 rounded-2xl bg-white/85 px-4 py-6 pb-24 shadow-sm backdrop-blur-md sm:my-6 sm:w-full sm:px-6 sm:pb-6">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
