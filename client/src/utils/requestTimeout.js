const LONG_RUNNING_API_PREFIXES = ['/ai/', '/coach/', '/tindermaxx/', '/hair/']

export function getRequestTimeoutMs(path) {
  return LONG_RUNNING_API_PREFIXES.some(prefix => path.startsWith(prefix))
    ? 130_000
    : 15_000
}
