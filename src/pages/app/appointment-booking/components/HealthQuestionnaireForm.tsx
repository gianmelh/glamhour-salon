import { Button, Input, Textarea } from '../../../../components'
import { cn } from '../../../../lib/cn'
import type { Client } from '../../../../types/api'
import { getHealthQuestionnaireMissingItems, healthQuestionnaires, isHealthQuestionnaireComplete, type YesNoAnswer } from '../health-questionnaires'
import type { BookingCategoryCode } from '../types'
import { mergeSignature } from './signatureHelpers'
import { ContraindicationBanner } from './HelpModal'
import { PhototypePicker, SignatureBox } from './SignatureBox'

function YesNoRadioGroup({ value, onChange, name }: {
  value: YesNoAnswer
  onChange: (value: YesNoAnswer) => void
  name: string
}) {
  return (
    <div className="flex gap-4">
      {(['yes', 'no'] as const).map((option) => (
        <label className="inline-flex cursor-pointer items-center gap-2 text-[16px] font-medium text-[#0a0a0a]" key={option}>
          <input
            checked={value === option}
            className="size-5 accent-[#7a48db]"
            name={name}
            type="radio"
            value={option}
            onChange={() => onChange(option)}
          />
          {option === 'yes' ? 'Yes' : 'No'}
        </label>
      ))}
    </div>
  )
}

export function HealthQuestionnaireForm({ categoryCode, client, details, notes, onChange }: {
  categoryCode: BookingCategoryCode
  client: Client
  details: Record<string, unknown>
  notes: string
  onChange: (details: Record<string, unknown>, notes: string) => void
}) {
  const definition = healthQuestionnaires[categoryCode]
  const answers = { ...((details.healthAnswers as Record<string, YesNoAnswer> | undefined) ?? {}) }
  const consents = { ...((details.consentItems as Record<string, boolean> | undefined) ?? {}) }
  const generalInfo = {
    fullName: String(details.healthFullName ?? client.full_name),
    phone: String(details.healthPhone ?? client.phone ?? ''),
    email: String(details.healthEmail ?? client.email ?? ''),
  }

  const patch = (patchDetails: Record<string, unknown>, nextNotes = notes) => onChange({ ...details, ...patchDetails }, nextNotes)

  const setAnswer = (id: string, value: YesNoAnswer) => {
    patch({ healthAnswers: { ...answers, [id]: value } })
  }

  const setConsent = (id: string, checked: boolean) => {
    const nextConsents = { ...consents, [id]: checked }
    const consentText = definition.consentItems.filter((item) => nextConsents[item.id]).map((item) => item.label).join(' ')
    patch({
      consentItems: nextConsents,
      consentAccepted: definition.consentItems.every((item) => nextConsents[item.id]),
      consents: definition.consentItems.every((item) => nextConsents[item.id])
        ? [{ type: `${categoryCode}_informed_consent`, version: 1, accepted: true, text: consentText }]
        : [],
    })
  }

  const today = new Date().toISOString().slice(0, 10)
  const hasContraindication = Object.values(answers).some((value) => value === 'yes')

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-[28px] font-extrabold leading-tight text-[#0c111d]">Health Questionnaire</h1>
        <p className="mt-2 text-[16px] text-[#666]">{definition.serviceLabel}</p>
      </header>

      <ContraindicationBanner visible={hasContraindication} />

      <section className="space-y-4">
        <h2 className="text-[21px] font-bold text-[#0c111d]">General Information</h2>
        <Input
          label="Full name"
          placeholder="e.g. John Doe"
          value={generalInfo.fullName}
          onChange={(event) => patch({ healthFullName: event.target.value })}
        />
        <Input
          label="Phone number"
          placeholder="e.g. 111 222 333"
          value={generalInfo.phone}
          onChange={(event) => patch({ healthPhone: event.target.value })}
        />
        <Input
          label="Email"
          placeholder="e.g. jane@glamhour.com"
          type="email"
          value={generalInfo.email}
          onChange={(event) => patch({ healthEmail: event.target.value })}
        />
      </section>

      {definition.sections.map((section) => (
        <section className="space-y-4 rounded-[20px] border border-[#d0d5dd] bg-[#fcfcfd] px-5 py-6" key={section.id}>
          <h2 className="text-[21px] font-bold text-[#0c111d]">{section.title}</h2>
          {section.questions.map((question) => (
            <div className="space-y-2" key={question.id}>
              <p className="text-[16px] leading-snug text-[#475467]">{question.label}</p>
              <YesNoRadioGroup
                name={`${categoryCode}-${question.id}`}
                onChange={(value) => setAnswer(question.id, value)}
                value={answers[question.id] ?? ''}
              />
            </div>
          ))}
        </section>
      ))}

      {definition.showPhototype && (
        <section className="rounded-[20px] border border-[#d0d5dd] bg-[#fcfcfd] px-5 py-6">
          <PhototypePicker onChange={(value) => patch({ phototype: value })} value={String(details.phototype ?? '')} />
        </section>
      )}

      <section className="space-y-4 rounded-[20px] border border-[#d0d5dd] bg-[#fcfcfd] px-5 py-6">
        <h2 className="text-[21px] font-bold text-[#0c111d]">Informed Consent</h2>
        <p className="text-[14px] text-[#666]">Please read carefully and check each box to declare your agreement.</p>
        {definition.consentItems.map((item) => (
          <label className={cn('flex cursor-pointer items-start gap-3 rounded-[12px] border p-3 text-[16px] text-[#0c111d]', consents[item.id] ? 'border-[#7344cd] bg-[#ebe7ff]' : 'border-[#e4e7ec] bg-white')} key={item.id}>
            <input
              checked={Boolean(consents[item.id])}
              className="mt-1 size-5 shrink-0 accent-[#7a48db]"
              type="checkbox"
              onChange={(event) => setConsent(item.id, event.target.checked)}
            />
            <span>{item.label}</span>
          </label>
        ))}

        <div className="space-y-4 rounded-[12px] bg-[#f2f5ff] p-4">
          <SignatureBox
            label="Professional signature"
            onChange={(value) => patch({
              professionalSignature: value,
              signatures: mergeSignature(
                details.signatures as Parameters<typeof mergeSignature>[0],
                { type: 'professional_signature', signerName: 'Provider', data: value },
              ),
            })}
            value={String(details.professionalSignature ?? '')}
          />
          <SignatureBox
            label="Client signature"
            onChange={(value) => patch({
              clientSignature: value,
              signatures: mergeSignature(
                details.signatures as Parameters<typeof mergeSignature>[0],
                { type: 'client_signature', signerName: client.full_name, data: value },
              ),
            })}
            value={String(details.clientSignature ?? '')}
          />
          <Input label="Date" readOnly type="date" value={String(details.consentDate ?? today)} />
        </div>
      </section>

      <Textarea
        label="Additional clinical notes"
        value={notes}
        onChange={(event) => onChange(details, event.target.value)}
      />
    </div>
  )
}

export function HealthQuestionnaireActions({ categoryCode, details, onBack, onSubmit }: {
  categoryCode: BookingCategoryCode
  details: Record<string, unknown>
  onBack?: () => void
  onSubmit: () => void
}) {
  const complete = isHealthQuestionnaireComplete(categoryCode, details)
  const missing = getHealthQuestionnaireMissingItems(categoryCode, details)

  return (
    <div className="sticky bottom-0 z-10 space-y-3 bg-[#f2f5ff] pb-4 pt-4">
      {!complete && (
        <div className="rounded-[16px] border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">Complete these items to submit:</p>
          <ul className="mt-2 space-y-1 text-sm text-amber-800">
            {missing.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      )}
      <Button
        className={cn('rounded-[16px] shadow-[0_16px_8px_rgba(0,0,0,0.09)]', !complete && 'opacity-60')}
        disabled={!complete}
        fullWidth
        onClick={onSubmit}
        type="button"
      >
        Confirm and Submit
      </Button>
      {onBack && (
        <Button fullWidth onClick={onBack} variant="outline">Go back</Button>
      )}
    </div>
  )
}

