import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  webpack: (config) => {
    // Browser-testing tools (Playwright MCP) write logs into .playwright-mcp/,
    // which otherwise retriggers dev rebuilds in an infinite loop.
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ["**/node_modules/**", "**/.git/**", "**/.next/**", "**/.playwright-mcp/**"],
    };
    return config;
  },
};

export default nextConfig;
