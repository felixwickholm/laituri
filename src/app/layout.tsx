import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Figtree, JetBrains_Mono } from "next/font/google";
import { headers } from "next/headers";
import { SandboxSignIn } from "@/components/session/SandboxSignIn";
import { LIVE_URL, PITCH } from "@/lib/evidence";
import { DEFAULT_THEME, THEME_BOOT_SCRIPT } from "@/lib/theme/theme";
import "./globals.css";

/** Open stand-ins for Valio Aimo's licensed faces: Figtree for text, Barlow Condensed for headings and buttons. */
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

const barlow = Barlow_Condensed({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const TITLE = "Laituri: the dock for AI agents";
const DESCRIPTION = PITCH;

export const metadata: Metadata = {
  metadataBase: new URL(LIVE_URL),
  title: { default: TITLE, template: "%s · Laituri" },
  description: DESCRIPTION,
  applicationName: "Laituri",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/brand/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "48x48" },
    ],
    apple: "/brand/apple-touch-icon.png",
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    siteName: "Laituri",
    locale: "en_GB",
    images: [{ url: "/brand/og-image.png", width: 1200, height: 630, alt: TITLE }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/brand/og-image.png"] },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e9f1f3" },
    { media: "(prefers-color-scheme: dark)", color: "#00222d" },
  ],
  viewportFit: "cover",
};

/** The proxy's per-request nonce lets the theme script past the Content-Security-Policy; a prerendered page has none. */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" data-theme={DEFAULT_THEME} className={`${figtree.variable} ${barlow.variable} ${jetbrainsMono.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        {children}
        <SandboxSignIn />
      </body>
    </html>
  );
}
