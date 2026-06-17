/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // Server Actions are origin-checked (CSRF). Allow the Codespaces forwarded host.
      allowedOrigins: ["*.app.github.dev", "*.githubpreview.dev", "localhost:3000"],
      bodySizeLimit: "30mb", // plan PDFs
    },
  },
};

export default nextConfig;
