import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Posters vem do TMDb; sem essa allowlist o next/image recusa a imagem
    // em runtime mesmo com a URL correta.
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org", pathname: "/t/p/**" },
    ],
  },
};

export default nextConfig;
