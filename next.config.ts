import type { NextConfig } from "next";

// output standalone: build enxuto pro Docker/Coolify (só config de build, não muda o app).
const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
