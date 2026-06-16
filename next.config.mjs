/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfjs-dist and @napi-rs/canvas are server-only native-ish deps; keep them external
  serverExternalPackages: ["pdfjs-dist", "@napi-rs/canvas"],
};

export default nextConfig;
