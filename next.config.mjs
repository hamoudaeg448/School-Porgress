/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["exceljs"],
  experimental: {
    serverActions: { bodySizeLimit: "6mb" }, // Excel uploads
  },
};
export default nextConfig;
