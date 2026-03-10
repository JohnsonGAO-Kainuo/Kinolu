import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/components/AuthProvider";
import BuiltinLutsInit from "@/components/BuiltinLutsInit";
import WhatsNew from "@/components/WhatsNew";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "Kinolu — AI Color Grading & Film Emulation for Mobile Photography",
    template: "%s — Kinolu",
  },
  description:
    "Turn any phone photo into cinematic film — match color grades from reference photos with AI color transfer. 50+ Fuji & Kodak film presets, professional curves & HSL tools. Free PWA, no download needed.",
  keywords: [
    /* Core — EN */
    "AI color grading", "color transfer", "photo color matching",
    "film emulation", "film preset", "cinematic color grade",
    "cinematic photo editor", "film look photo editor",
    "analog film filter", "movie color grading",
    "Fuji film emulation", "Kodak film preset", "Portra 400 preset",
    "LUT photo editor", "photo color grading app",
    "reference photo color match", "one-tap color grade",
    "mobile film photography", "phone cinematic photo",
    "online photo editor", "browser photo editor", "PWA photo app",
    "free photo color grading",
    /* Core — 中文 */
    "AI调色", "一键追色", "色彩迁移", "仿色",
    "胶片滤镜", "胶片感", "电影感调色", "电影色调",
    "手机拍出胶片感", "手机电影感照片",
    "富士胶片模拟", "柯达胶片预设",
    "照片调色", "色彩转换", "参考图调色",
    "在线调色工具", "手机调色app",
  ],
  manifest: "/manifest.json",
  metadataBase: new URL("https://kinolu.cam"),
  alternates: { canonical: "https://kinolu.cam" },
  openGraph: {
    title: "Kinolu — AI Color Grading & Film Emulation",
    description:
      "Match any color grade from a reference photo. 50+ film presets, professional editing tools — all in your browser.",
    url: "https://kinolu.cam",
    siteName: "Kinolu",
    type: "website",
    locale: "en_US",
    images: [{ url: "/heroes/editor.jpg", width: 1200, height: 630, alt: "Kinolu — AI Photo Color Grading App" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kinolu — AI Color Grading & Film Emulation",
    description:
      "Match any color grade from a reference photo. 50+ film presets, professional tools in your browser.",
    images: ["/heroes/editor.jpg"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Kinolu",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icon-512-maskable.png" />
      </head>
      <body className="antialiased">
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "Kinolu",
              applicationCategory: "PhotographyApplication",
              operatingSystem: "Any (Web Browser)",
              url: "https://kinolu.cam",
              description:
                "AI-powered photo color grading app. Match any color grade from a reference photo, apply 50+ film presets (Fuji, Kodak), and edit with professional curves & HSL tools — all in your browser.",
              screenshot: "https://kinolu.cam/heroes/editor.jpg",
              offers: [
                { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Free tier — 3 color transfers per day" },
                { "@type": "Offer", price: "2.99", priceCurrency: "USD", description: "Pro Monthly — unlimited transfers" },
                { "@type": "Offer", price: "19.99", priceCurrency: "USD", description: "Pro Annual — best value" },
              ],
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: "4.8",
                ratingCount: "120",
                bestRating: "5",
              },
              featureList: [
                "AI Color Transfer from Reference Photos",
                "50+ Film Emulation Presets (Fuji, Kodak, Cinematic)",
                "Professional Curves & HSL Editor",
                "One-Tap Film Look",
                "PWA — Works Offline",
                "No Download Required",
              ],
            }),
          }}
        />
        <I18nProvider>
          <AuthProvider>
            <BuiltinLutsInit />
            <WhatsNew />
            {children}
          </AuthProvider>
        </I18nProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `if("serviceWorker"in navigator){navigator.serviceWorker.register("/sw.js").then(function(reg){reg.addEventListener("updatefound",function(){var w=reg.installing;if(w){w.addEventListener("statechange",function(){if(w.state==="installed"&&navigator.serviceWorker.controller){var d=document.createElement("div");d.id="sw-toast";d.style.cssText="position:fixed;bottom:env(safe-area-inset-bottom,20px);left:50%;transform:translateX(-50%);z-index:99999;background:rgba(30,30,30,0.95);color:#fff;padding:12px 20px;border-radius:14px;font:500 13px/-apple-system,BlinkMacSystemFont,sans-serif;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;gap:12px;box-shadow:0 8px 32px rgba(0,0,0,0.4);margin-bottom:20px";d.innerHTML='<span>New version available</span><button onclick=\"location.reload()\" style=\"background:rgba(255,255,255,0.15);color:#fff;border:none;padding:6px 14px;border-radius:8px;font:500 12px system-ui;cursor:pointer\">Update</button>';document.body.appendChild(d)}})}});setInterval(function(){reg.update()},60*60*1000)})}`,
          }}
        />
      </body>
    </html>
  );
}
