import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PayWise | Smart Banking Assistant",
  description: "Agentic retail banking & personal budget management powered by Gemini",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-emerald-100 selection:text-emerald-900">
        {children}
      </body>
    </html>
  );
}
