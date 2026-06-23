/** @type {import('next').NextConfig} */
const nextConfig = {
  // native/worker-ish PDF deps — don't bundle, load at runtime on the server
  serverExternalPackages: ["pdfjs-dist", "@napi-rs/canvas", "pdf-lib"],
  // Skip the redundant build-time type-check/lint — they were the slow, memory-heavy phase that kept
  // getting killed in this Codespace. Types are still validated separately via `npx tsc --noEmit`.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    webpackBuildWorker: false,
    serverActions: {
      // Server Actions are origin-checked (CSRF). Allow the Codespaces forwarded host.
      allowedOrigins: ["*.app.github.dev", "*.githubpreview.dev", "localhost:3000", "localhost:3001"],
      bodySizeLimit: "100mb", // plan PDFs — full CD sets can be large
    },
  },
};

export default nextConfig;
