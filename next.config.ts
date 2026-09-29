import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@bini59/design"],
  serverExternalPackages: ["playwright"],
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/playwright-core/**/*",
      "./node_modules/playwright/node_modules/playwright-core/**/*",
    ],
  },
  experimental: {
    useTypeScriptCli: true,
  },
};

export default nextConfig;
