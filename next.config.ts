import type { NextConfig } from "next";
import { generateVersionToken } from './src/lib/utils';

// Generate version token at build time
const VERSION_TOKEN = generateVersionToken();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  env: {
    // Explicitly expose these environment variables to the client
    NEXT_PUBLIC_AZURE_CLIENT_ID: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID,
    NEXT_PUBLIC_AZURE_TENANT_ID: process.env.NEXT_PUBLIC_AZURE_TENANT_ID,
    NEXT_PUBLIC_AZURE_REDIRECT_URI: process.env.NEXT_PUBLIC_AZURE_REDIRECT_URI,
    VERSION_TOKEN: VERSION_TOKEN,
  },
};

export default nextConfig;
