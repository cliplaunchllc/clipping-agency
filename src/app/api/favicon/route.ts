import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Rocket SVG fallback (same as icon.svg)
const ROCKET_SVG = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 2C9.5 4.5 8 8 8 12H16C16 8 14.5 4.5 12 2Z" fill="#FF5A5F" />
  <path d="M12 2C10.8 3.5 9.8 5.5 9.2 8H12V2Z" fill="#FF5A5F" opacity="0.5" />
  <circle cx="12" cy="9" r="1.5" fill="white" opacity="0.9" />
  <circle cx="12" cy="9" r="0.7" fill="#FF5A5F" />
  <path d="M8 12H16V15.5C16 16 14 16.5 12 16.5C10 16.5 8 16 8 15.5V12Z" fill="#DC2626" />
  <path d="M8 12.5L5.5 15.5L8 15.5V12.5Z" fill="#DC2626" />
  <path d="M16 12.5L18.5 15.5L16 15.5V12.5Z" fill="#DC2626" />
  <path d="M10.5 16.5C10.5 16.5 11 18 12 19.5C13 18 13.5 16.5 13.5 16.5H10.5Z" fill="#F5B94A" opacity="0.9" />
</svg>`;

export async function GET() {
  const setting = await prisma.siteSetting.findUnique({ where: { key: "agency_logo" } });
  const logoUrl = setting?.value ?? null;

  // If a logo is set and it's a base64 data URL, extract the raw bytes
  if (logoUrl && logoUrl.startsWith("data:")) {
    const [meta, b64] = logoUrl.split(",");
    const mimeMatch = meta.match(/data:([^;]+)/);
    const mime = mimeMatch?.[1] ?? "image/png";
    const buffer = Buffer.from(b64, "base64");
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  }

  // If it's a regular URL, redirect to it
  if (logoUrl && logoUrl.startsWith("http")) {
    return NextResponse.redirect(logoUrl);
  }

  // Fall back to the rocket SVG
  return new NextResponse(ROCKET_SVG, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
