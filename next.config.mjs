/** @type {import('next').NextConfig} */
const nextConfig = {
  // native/worker-ish PDF deps — don't bundle, load at runtime on the server
  serverExternalPackages: ["pdfjs-dist", "@napi-rs/canvas", "pdf-lib"],
  experimental: {
    serverActions: {
      // Server Actions are origin-checked (CSRF). Allow the Codespaces forwarded host.
      allowedOrigins: ["*.app.github.dev", "*.githubpreview.dev", "localhost:3000"],
      bodySizeLimit: "100mb", // plan PDFs — full CD sets can be large
    },
  },
};

export default nextConfig;
