import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Parley — Meeting intelligence", template: "%s · Parley" },
  description: "Turn every meeting into searchable, actionable knowledge.",
};

export const viewport: Viewport = {
  themeColor: "#f7f7f5",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            className: "!rounded-xl !border-line !shadow-pop !font-sans !text-[13px]",
          }}
        />
      </body>
    </html>
  );
}
