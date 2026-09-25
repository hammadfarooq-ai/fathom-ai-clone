import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { cookies } from "next/headers";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const instrumentSerif = Instrument_Serif({ variable: "--font-instrument-serif", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: { default: "Parley", template: "%s · Parley" },
  description: "Meeting notes you can search, question, and share.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f1ea" },
    { media: "(prefers-color-scheme: dark)", color: "#141310" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Explicit theme choice (cookie); without one, CSS follows the OS setting.
  const theme = (await cookies()).get("parley-theme")?.value;
  return (
    <html
      lang="en"
      data-theme={theme === "dark" || theme === "light" ? theme : undefined}
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {children}
        <Toaster
          position="top-center"
          offset={68}
          toastOptions={{
            className: "!rounded-lg !border-rule !bg-card !text-ink !shadow-pop !font-sans !text-[13px]",
          }}
        />
      </body>
    </html>
  );
}
