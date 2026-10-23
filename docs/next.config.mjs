import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

// Set DEPLOY_TARGET=static to produce a fully static export (e.g. for GitHub
// Pages). Search already uses a static index, and OG images are prerendered, so
// the export is self-contained. Default (unset) builds for Vercel/Node hosting.
const isStaticExport = process.env.DEPLOY_TARGET === 'static';

// GitHub Pages serves a project site under /<repo>/, so the static export takes the path of the
// site URL as its basePath (same default as siteUrl in lib/shared.ts; a custom domain yields '').
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://weibschatten.github.io/We1ssBoard';
const basePath = isStaticExport ? new URL(siteUrl).pathname.replace(/\/+$/, '') : '';

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  basePath,
  // next/link and next/image apply basePath themselves; plain src/href strings go through withBasePath.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  // On the static host (GitHub Pages) emit directory-style routes
  // (`en/index.html` rather than `en.html`) so URLs with a trailing slash —
  // including the root `/` → `/en/` redirect — resolve instead of 404ing.
  ...(isStaticExport
    ? { output: 'export', trailingSlash: true, images: { unoptimized: true } }
    : {}),
};

export default withMDX(config);
