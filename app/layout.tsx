import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "aresearch",
  description: "Semantic search over local documents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-page-bg text-neutral-800 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
