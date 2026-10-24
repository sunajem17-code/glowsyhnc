const LONG_RUNNING_API_PREFIXES = ['/ai/', '/coach/', '/tindermaxx/', '/hair/']

export async function withDeadline(operation, timeoutMs, message) {
  let timer
  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), timeoutMs) }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

export function getRequestTimeoutMs(path) {
  return LONG_RUNNING_API_PREFIXES.some(prefix => path.startsWith(prefix))
    ? 130_000
    : 15_000
}
