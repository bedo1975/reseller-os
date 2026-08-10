import type { Metadata } from "next";

/**
 * Admin layout — overrides the root layout's metadata for /admin routes.
 *
 * The root layout (src/app/layout.tsx) defines the boutique icons (blue "B").
 * This layout overrides them with the admin icons (green "R") for /admin/*.
 *
 * Note: we only export metadata here, no JSX. The children render directly
 * through the root layout's LayoutShell (which renders them raw for /admin).
 */
export const metadata: Metadata = {
  title: "Admin — Reseller OS",
  description: "Back-office Reseller OS",
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
    shortcut: "/icon-192.png",
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
