export class IpRateLimiter {
  private entries = new Map<string, { count: number; resetAt: number }>()

  take(key: string, limit: number, windowMs: number, now: number) {
    let entry = this.entries.get(key)
    if (!entry || entry.resetAt <= now) {
      if (this.entries.size >= 10000) {
        for (const [storedKey, stored] of this.entries) if (stored.resetAt <= now) this.entries.delete(storedKey)
        if (this.entries.size >= 10000 && !this.entries.has(key)) return Math.ceil(windowMs / 1000)
      }
      entry = { count: 0, resetAt: now + windowMs }
      this.entries.set(key, entry)
    }
    entry.count++
    return entry.count > limit ? Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) : null
  }
}
