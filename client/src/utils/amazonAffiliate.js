// Public Associates configuration already used by the curated catalog.
export const AMAZON_ORIGIN = 'https://www.amazon.ca'
export const AMAZON_TAG = 'ascendusapp05-20'
export function amazonSearchUrl(query) {
  const url = new URL('/s', AMAZON_ORIGIN)
  url.searchParams.set('k', String(query ?? '').trim())
  url.searchParams.set('tag', AMAZON_TAG)
  return url.href
}
export function amazonProductUrl(asin) {
  const url = new URL(`/dp/${asin}`, AMAZON_ORIGIN)
  url.searchParams.set('tag', AMAZON_TAG)
  return url.href
}
