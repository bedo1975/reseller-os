import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "sonner";
import { SessionProviderWrapper } from "@/components/providers/session-provider";
import { ConfirmProvider } from "@/components/shared/confirm-provider";
import { ServiceWorkerRegister } from "@/components/shared/sw-register";
import { LayoutShell } from "@/components/boutique/layout-shell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Reseller OS — Gestion multi-plateformes",
  description: "Centralisez Vinted, Leboncoin, eBay, Vestiaire Collective, stock physique, comptabilité et rentabilité en une seule application.",
  keywords: ["reseller", "Vinted", "Leboncoin", "eBay", "Vestiaire Collective", "revente", "stock"],
  authors: [{ name: "Reseller OS" }],
  manifest: "/manifest.json",
  // Boutique icons — generated dynamically by /icon.svg (reads faviconLetter + faviconBgColor
  // from BoutiqueSettings). The admin route overrides this in src/app/admin/layout.tsx
  // with a static green "R" icon.
  icons: {
    icon: "/icon.svg",
    apple: "/icon-boutique-192.png",
    shortcut: "/favicon-boutique.ico",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Reseller OS",
  },
};

export const viewport = {
  themeColor: "#10b981",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <SessionProviderWrapper>
          <ConfirmProvider>
            <LayoutShell>{children}</LayoutShell>
          </ConfirmProvider>
        </SessionProviderWrapper>
        <SonnerToaster position="top-right" richColors closeButton />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
