/** A settings change supersedes category selections in an older onboarding draft. */
export function syncStoredOnboardingCategories(salonId: string, categoryIds: string[]) {
  const key = `glamhour:onboarding:${salonId}`
  try {
    const value = window.localStorage.getItem(key)
    if (!value) return
    const draft: unknown = JSON.parse(value)
    if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return
    window.localStorage.setItem(key, JSON.stringify({ ...draft, selectedCategoryIds: [...new Set(categoryIds)] }))
  } catch {
    // Storage may be unavailable; persisted salon categories remain authoritative.
  }
}
