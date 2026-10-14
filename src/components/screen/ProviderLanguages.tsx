import { cn } from '../../lib/cn'
import { normalizeLanguages, providerLanguageOptions } from '../../lib/provider-settings'

export function ProviderLanguages({ languages, onChange }: { languages: string[]; onChange: (languages: string[]) => void }) {
  const selected = normalizeLanguages(languages)
  return (
    <div className="flex flex-wrap gap-2">
      {providerLanguageOptions.map((language) => (
        <button
          aria-pressed={selected.includes(language)}
          className={cn('rounded-md border px-3 py-2 text-xs font-semibold', selected.includes(language) ? 'border-primary bg-lavender text-primary' : 'border-border bg-surface text-[#68738b]')}
          key={language}
          onClick={() => onChange(selected.includes(language) ? selected.filter((item) => item !== language) : [...selected, language])}
          type="button"
        >
          {language}
        </button>
      ))}
    </div>
  )
}
