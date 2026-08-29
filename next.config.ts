import type { NextConfig } from 'next'

const isPages = process.env.DEPLOY_TARGET === 'gh-pages'

const config: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  basePath: isPages ? '/mac-prices' : undefined,
  trailingSlash: true,
}

export default config
