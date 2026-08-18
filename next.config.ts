import type { NextConfig } from "next";

// output standalone: build enxuto pro Docker/Coolify (só config de build, não muda o app).
const nextConfig: NextConfig = {
  output: "standalone",
  // O site da padaria mora em public/site. O Next não serve índice de pasta,
  // então /site dava 404 e só /site/index.html abria. URL com "index.html" na
  // verificação da Meta é o tipo de detalhe que faz um analista desconfiar.
  async rewrites() {
    return [
      { source: "/site", destination: "/site/index.html" },
      { source: "/padaria", destination: "/site/index.html" },
    ];
  },
};

export default nextConfig;
