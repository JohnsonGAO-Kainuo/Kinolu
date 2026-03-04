import type { Metadata, Viewport } from "next";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/components/AuthProvider";
import BuiltinLutsInit from "@/components/BuiltinLutsInit";
import WhatsNew from "@/components/WhatsNew";

export const metadata: Metadata = {
  title: "Kinolu",
  description: "Photo color grading, reimagined.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Kinolu",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="antialiased">
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
