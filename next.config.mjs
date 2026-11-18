/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: { bodySizeLimit: "6mb" }, // Excel uploads
  },
};
export default nextConfig;
