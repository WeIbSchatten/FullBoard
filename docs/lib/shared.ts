export const appName = 'FullBoard';
export const appTagline = 'Advanced web panel for managing Xray-core servers';

export const docsRoute = '/docs';
export const docsImageRoute = '/og/docs';
export const docsContentRoute = '/llms.mdx/docs';

// The FullBoard product repository — used for the navbar GitHub link,
// build-time star/release stats, and install commands.
export const productRepo = {
  user: 'WeIbSchatten',
  repo: 'FullBoard',
  branch: 'main',
};

// Where these docs live in the FullBoard monorepo — used for "Edit on GitHub" links.
export const gitConfig = {
  user: 'WeIbSchatten',
  repo: 'FullBoard',
  branch: 'main',
  docsDir: 'docs/content/docs',
};

export const productRepoUrl = `https://github.com/${productRepo.user}/${productRepo.repo}`;

// AI-generated interactive wiki of the FullBoard codebase.
export const deepWikiUrl = `https://deepwiki.com/${productRepo.user}/${productRepo.repo}`;

// Telegram community channel (announcements & support).
export const telegramChannel = 'XrayUI';
export const telegramChannelUrl = `https://t.me/${telegramChannel}`;

// Public site origin, used for metadataBase / canonical URLs / OG images.
// Defaults to the GitHub Pages URL, so the env var is optional. Use `||` (not
// `??`) so an empty string — e.g. an unset `${{ vars.NEXT_PUBLIC_SITE_URL }}`
// in CI — also falls back instead of shipping a blank origin.
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://weibschatten.github.io/FullBoard';
