/** @type {import('next').NextConfig} */

// NEXT_PUBLIC_BASE_PATH is set by the GitHub Actions workflow to '/repo-name'.
// For local dev it is unset, which is correct (no prefix needed).
// If you deploy to a custom domain, set NEXT_PUBLIC_BASE_PATH="" in the workflow.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

const nextConfig = {
  trailingSlash: true,
  images: { unoptimized: true },
  basePath,
  assetPrefix: basePath,
}

module.exports = nextConfig
