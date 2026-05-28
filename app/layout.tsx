import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import "@copilotkit/react-ui/styles.css";
import { Providers } from "@/app/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RepoRadar: Smarter repo discovery for builders",
  description:
    "Tune 10 dimensions to surface trending GitHub repos that match your priorities. Deploy AI-generated interactive surfaces for any repo. Stop scrolling. Start building.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
  },
  openGraph: {
    title: "RepoRadar: Smarter repo discovery for builders",
    description:
      "Tune sliders, surface trending GitHub repos, and deploy a unique interactive surface for any repo on demand.",
    url: "https://reporadar.io",
    siteName: "RepoRadar",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "RepoRadar: Smarter repo discovery for builders",
    description:
      "Tune sliders, surface trending GitHub repos, and deploy a unique interactive surface for any repo on demand.",
  },
};

// CF Web Analytics beacon token. NEXT_PUBLIC_ prefix makes it available at
// build-time in client bundles. The beacon renders ONLY when this is set —
// no empty script tag, no token leak when unset (D-11).
const beaconToken = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        <Providers>{children}</Providers>
      </body>
      {beaconToken && (
        <Script
          id="cf-beacon"
          src="https://static.cloudflareinsights.com/beacon.min.js"
          strategy="afterInteractive"
          data-cf-beacon={JSON.stringify({ token: beaconToken })}
        />
      )}
    </html>
  );
}
