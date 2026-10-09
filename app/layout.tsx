import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://integritass.com";

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Integritas | Legal • Compliance • Investment • Business Consulting",
    template: "%s | Integritas",
  },
  description:
    "Cross-border legal, commercial and project-management counsel for international trade, transactions, contracts, investment and regulated industries.",
  applicationName: "Integritas",
  authors: [{ name: "Integritas" }],
  creator: "Integritas",
  publisher: "Integritas",
  alternates: { canonical: "/" },
  icons: {
    icon: [{ url: "/brand/integritas-compact-mark.png", type: "image/png", sizes: "512x512" }],
    apple: [{ url: "/brand/integritas-compact-mark.png", sizes: "512x512" }],
  },
  openGraph: {
    title: "Integritas | Integrity in every cross-border decision",
    description:
      "Legal, commercial and project-management counsel for organisations operating across borders.",
    type: "website",
    locale: "en_ZA",
    siteName: "Integritas",
    url: "/",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Integritas — Integrity, Governance, Excellence" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Integritas | Integrity in every cross-border decision",
    description: "Legal, commercial and project-management counsel for organisations operating across borders.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: "Integritas",
  description: "Cross-border legal, commercial and project-management consulting.",
  url: siteUrl,
  logo: `${siteUrl}/brand/integritas-compact-mark.png`,
  email: "info@integritass.com",
  telephone: "+27 61 502 6507",
  address: {
    "@type": "PostalAddress",
    streetAddress: "94 Regency Drive, Route 21 Corporate Park",
    addressLocality: "Irene",
    addressRegion: "Gauteng",
    addressCountry: "ZA",
  },
  areaServed: "Worldwide",
  knowsAbout: [
    "International trade compliance",
    "Cross-border transactions",
    "Contract law",
    "Energy, oil and gas",
    "Trade finance",
    "Foreign direct investment",
    "Project management",
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${playfair.variable} ${inter.variable} antialiased`}>
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </body>
    </html>
  );
}
