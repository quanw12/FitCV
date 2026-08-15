type ResourceCacheEntry<T> = {
  value: T
  updatedAt: number
}

const cache = new Map<string, ResourceCacheEntry<unknown>>()

const pending = new Map<string, Promise<unknown>>()

let cacheGeneration = 0

export function getCachedResource<T>(key: string): T | undefined {
  return cache.get(key)?.value as T | undefined
}

export function setCachedResource<T>(key: string, value: T): T {
  cache.set(key, { value, updatedAt: Date.now() })

  return value
}

export function clearResourceCache(prefix?: string) {
  cacheGeneration += 1

  if (!prefix) {
    cache.clear()
    pending.clear()

    return
  }

  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key)
  }

  for (const key of pending.keys()) {
    if (key.startsWith(prefix)) pending.delete(key)
  }
}

export async function getOrFetchResource<T>(
  key: string,
  loader: () => Promise<T>,
  options: { force?: boolean } = {},
): Promise<T> {
  const cached = getCachedResource<T>(key)

  if (!options.force && cached !== undefined) return cached

  const inFlight = pending.get(key) as Promise<T> | undefined

  if (!options.force && inFlight) return inFlight

  const generation = cacheGeneration
  const request = loader()
    .then((value) => {
      if (generation === cacheGeneration) setCachedResource(key, value)

      return value
    })
    .finally(() => {
      if (pending.get(key) === request) pending.delete(key)
    })

  pending.set(key, request)

  return request
}
