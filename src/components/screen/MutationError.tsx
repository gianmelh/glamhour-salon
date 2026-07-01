export function MutationError({ error }: { error: Error | null }) {
  if (!error) return null
  return <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error.message}</p>
}
