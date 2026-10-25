import { Card } from '../../../components'
import type { Client, ClientClinicalForm } from '../../../types/api'
import { signaturePathData } from '../appointment-booking/appointmentClinicalView'
import { healthQuestionnaires } from '../appointment-booking/health-questionnaires'
import type { BookingCategoryCode } from '../appointment-booking/types'
import { clinicalDate, clinicalFormDetails } from './clinicalFormDetails'

export function ClientClinicalFormSummary({ client, record, category }: { client: Client; record: ClientClinicalForm; category: BookingCategoryCode }) {
  const details = clinicalFormDetails(record)
  const definition = healthQuestionnaires[category]
  const answers = details.healthAnswers as Record<string, unknown>
  const consents = (details.consentItems ?? {}) as Record<string, boolean>

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h3 className="font-bold">General Information</h3>
        <Value label="Full name" value={details.healthFullName ?? client.full_name} />
        <Value label="Phone number" value={details.healthPhone ?? client.phone} />
        <Value label="Email" value={details.healthEmail ?? client.email} />
        {definition.showPhototype && <Value label="Fitzpatrick phototype" value={details.phototype} />}
      </Card>
      {definition.sections.map((section) => (
        <Card className="space-y-3" key={section.id}>
          <h3 className="font-bold">{section.title}</h3>
          <dl className="divide-y divide-border">
            {section.questions.map((question) => (
              <div className="py-3 first:pt-0 last:pb-0" key={question.id}>
                <dt className="text-sm leading-5 text-muted">{question.label}</dt>
                <dd className={`mt-1 text-sm font-semibold ${answers[question.id] === 'yes' ? 'text-[#b54708]' : 'text-ink'}`}>
                  {answers[question.id] === 'yes' ? 'Yes' : answers[question.id] === 'no' ? 'No' : 'Not answered'}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      ))}
      <Card className="space-y-4">
        <h3 className="font-bold">Informed Consent</h3>
        {definition.consentItems.map((item) => (
          <div key={item.id}>
            <p className="text-sm leading-5 text-muted">{item.label}</p>
            <p className="mt-1 text-sm font-semibold">{consents[item.id] === true ? 'Accepted' : 'Not recorded'}</p>
          </div>
        ))}
        <Value label="Date" value={clinicalDate(typeof details.consentDate === 'string' ? details.consentDate : null)} />
        <Value label="Time" value={details.consentTime} />
        {([['professionalSignature', 'Professional signature'], ['clientSignature', 'Client signature']] as const).map(([key, label]) => (
          <div key={key}>
            <p className="mb-2 text-xs font-bold text-muted">{label}</p>
            {typeof details[key] === 'string' && details[key] ? (
              <svg aria-label={label} className="h-32 w-full rounded-lg border border-border bg-white" role="img" viewBox="0 0 320 128">
                <path d={signaturePathData(details[key])} fill="none" stroke="#111827" strokeLinecap="round" strokeWidth="3" />
              </svg>
            ) : <p className="text-sm">Not recorded</p>}
          </div>
        ))}
      </Card>
      <Card><Value label="Additional clinical notes" value={record.notes} /></Card>
    </div>
  )
}

function Value({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm">{typeof value === 'string' && value ? value : 'Not recorded'}</p>
    </div>
  )
}
