/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ce dashboard lit le système de fichiers local (~/.claude), il tourne donc
  // uniquement en local. Pas de télémétrie ni d'optimisations distantes requises.
  reactStrictMode: true,
};

export default nextConfig;
