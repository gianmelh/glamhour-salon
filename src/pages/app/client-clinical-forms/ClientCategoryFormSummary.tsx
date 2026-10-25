import { Card } from '../../../components'
import type { Client, ClientClinicalForm } from '../../../types/api'
import { signaturePathData } from '../appointment-booking/appointmentClinicalView'

const hiddenFields = new Set([
  'category', 'registrationStep', 'previewReturnStep', 'photoCapturePending', 'photoLocalPreviewUrl',
  'usedExistingHealthProfile', 'existingQuestionnaireId', 'micropigmentationServiceIds',
  'signatures', 'consents', 'mediaItems', 'photoStorageKey', 'faceMapSavedAt', 'materialIds',
  'activeHand', 'activeFinger', 'activeLashEye',
])
const labels: Record<string, string> = {
  generalFullName: 'Full name', generalPhone: 'Phone number', generalEmail: 'Email', generalDateOfBirth: 'Date of birth',
  healthFullName: 'Full name', healthPhone: 'Phone number', healthEmail: 'Email',
  nailServiceType: 'Service type', nailType: 'Nail shape', skin_type: 'Skin diagnosis', phototype: 'Fitzpatrick phototype',
  isFirstTime: 'First visit', healthAnswers: 'Health questionnaire', healthHistory: 'Health history',
  rightHand: 'Right hand measurements', leftHand: 'Left hand measurements', lashMap: 'Lash map', faceAnnotations: 'Face map',
  widthMm: 'Width (mm)', lengthMm: 'Length (mm)', capsuleNumber: 'Capsule number',
  consentDate: 'Signature date', consentTime: 'Signature time', professionalSignature: 'Professional signature',
  clientSignature: 'Client signature', clientDesignSignature: 'Design approval signature', photoPreviewUrl: 'Reference photo',
}
function labelFor(key: string) {
  return labels[key] ?? key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase())
}
function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== ''
    && (!Array.isArray(value) || value.length > 0)
    && (typeof value !== 'object' || Object.keys(value).length > 0)
}

export function ClientCategoryFormSummary({ client, record }: { client: Client; record: ClientClinicalForm }) {
  const entries = Object.entries(record.form_details).filter(([key, value]) => !hiddenFields.has(key) && hasValue(value))
  return (
    <div className="space-y-3">
      <Card className="space-y-1">
        <p className="font-semibold">{client.full_name}</p>
        <p className="text-xs text-muted">{client.phone ?? client.email}</p>
      </Card>
      {entries.map(([key, value]) => (
        <Card key={key}>
          <h3 className="mb-2 text-sm font-bold">{labelFor(key)}</h3>
          <ClinicalValue field={key} value={value} />
        </Card>
      ))}
      <Card>
        <h3 className="mb-2 text-sm font-bold">Additional clinical notes</h3>
        <p className="whitespace-pre-wrap break-words text-sm">{record.notes || 'Not recorded'}</p>
      </Card>
    </div>
  )
}

function ClinicalValue({ field, value }: { field: string; value: unknown }) {
  if (field === 'photoPreviewUrl' && typeof value === 'string') return <img alt="Clinical reference" className="max-h-64 w-full rounded-lg object-contain" loading="lazy" src={value} />
  if (/signature$/i.test(field) && typeof value === 'string' && /^\d+,\d+(\s+\d+,\d+)*$/.test(value)) return (
    <svg aria-label={labelFor(field)} className="h-32 w-full rounded-lg border border-border bg-white" role="img" viewBox="0 0 320 128">
      <path d={signaturePathData(value)} fill="none" stroke="#111827" strokeLinecap="round" strokeWidth="3" />
    </svg>
  )
  if (typeof value === 'boolean') return <p className="text-sm">{value ? 'Yes' : 'No'}</p>
  if (Array.isArray(value)) {
    if (value.every((item) => typeof item !== 'object')) return <p className="whitespace-pre-wrap break-words text-sm">{value.join(', ')}</p>
    return <div className="space-y-3">{value.map((item, index) => <div className="border-l-2 border-border pl-3" key={index}><ClinicalValue field={field} value={item} /></div>)}</div>
  }
  if (value && typeof value === 'object') return (
    <dl className="space-y-2">{Object.entries(value).filter(([, item]) => hasValue(item)).map(([key, item]) => (
      <div key={key}><dt className="text-xs font-semibold text-muted">{labelFor(key)}</dt><dd className="mt-1"><ClinicalValue field={key} value={item} /></dd></div>
    ))}</dl>
  )
  return <p className="whitespace-pre-wrap break-words text-sm">{value === 'yes' ? 'Yes' : value === 'no' ? 'No' : String(value ?? '')}</p>
}
