import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import SpaceBackground from "@/components/shared/SpaceBackground";

export const metadata: Metadata = {
  title: "ClipLaunch",
  description: "Clipping agency management dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body style={{ background: "#05070D", color: "#F5F6FA" }}>
        <SpaceBackground />
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
