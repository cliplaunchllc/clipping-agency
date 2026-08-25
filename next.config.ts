import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bind to Railway's dynamic PORT
  // Next.js reads process.env.PORT automatically in production
  output: "standalone",
};

export default nextConfig;
