/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // Server Actions are origin-checked (CSRF). Allow the Codespaces forwarded host.
      allowedOrigins: ["*.app.github.dev", "*.githubpreview.dev", "localhost:3000"],
    },
  },
};

export default nextConfig;
