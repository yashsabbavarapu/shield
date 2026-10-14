import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { writesAuthenticated } from "@/lib/guard";

export const metadata: Metadata = { title: "Shield", description: "Send-readiness checks for copy, domains and lists." };
export const dynamic = "force-dynamic";

const NAV = [
  ["/copy", "Copy"],
  ["/domain", "Domain"],
  ["/list", "List"],
  ["/suppressions", "Suppressions"],
  ["/log", "Log"],
] as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        <header className="border-b border-gray-200">
          <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3 text-sm">
            <Link href="/" className="font-semibold">Shield</Link>
            {NAV.map(([href, label]) => (
              <Link key={href} href={href} className="text-gray-600 hover:text-gray-900">{label}</Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        {!writesAuthenticated() && <p className="mx-auto max-w-5xl px-4 pb-6 text-xs text-gray-500">API writes are unauthenticated.</p>}
      </body>
    </html>
  );
}
