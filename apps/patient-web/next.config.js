/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    tsconfigPath: './tsconfig.json',
  },
  webpack: (config) => {
    // Add any webpack customizations here
    return config;
  },
};

module.exports = nextConfig;
