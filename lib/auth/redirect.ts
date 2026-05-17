const LOCAL_ORIGIN = 'https://promptier.local'

export function getSafeRedirectPath(
  value: string | null | undefined,
  fallback = '/vault',
) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return fallback
  }

  try {
    const url = new URL(value, LOCAL_ORIGIN)
    if (url.origin !== LOCAL_ORIGIN) return fallback
    if (url.pathname === '/getstarted' || url.pathname === '/auth/signin') return fallback
    return `${url.pathname}${url.search}${url.hash}` || fallback
  } catch {
    return fallback
  }
}

export function getGetStartedPath(nextPath: string | null | undefined = '/vault') {
  const safeNextPath = getSafeRedirectPath(nextPath)
  return safeNextPath === '/vault'
    ? '/getstarted'
    : `/getstarted?next=${encodeURIComponent(safeNextPath)}`
}
