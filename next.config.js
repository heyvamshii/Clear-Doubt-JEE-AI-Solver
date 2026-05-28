/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow larger request bodies so phone-camera images (base64) go through cleanly.
  // Images are client-resized to <= 1280px before upload, so payloads are typically
  // 200-600 KB. 8 MB gives plenty of headroom for high-quality uploads.
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
};

module.exports = nextConfig;
