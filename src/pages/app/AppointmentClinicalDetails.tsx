import { AlertTriangle } from 'lucide-react'
import { Card } from '../../components'
import { ReviewRow } from './appointment-booking/components/shared'
import { buildAppointmentClinicalView, signaturePathData } from './appointment-booking/appointmentClinicalView'
import type { Appointment } from '../../types/api'

export function AppointmentClinicalDetails({ appointment }: { appointment: Appointment }) {
  const view = buildAppointmentClinicalView(appointment)

  return (
    <div className="space-y-4">
      {view.contraindications.length > 0 && (
        <Card className="flex items-start gap-3 rounded-[20px] border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-bold text-amber-900">Contraindications noted</p>
            <ul className="mt-2 space-y-1 text-xs text-amber-800">
              {view.contraindications.map((item) => (
                <li key={item.value}>{item.value}</li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      {view.sections.map((section) => (
        <Card className="space-y-3 rounded-[20px] border-[#d0d5dd] bg-white p-4" key={section.title}>
          <p className="text-[21px] font-bold text-[#0c111d]">{section.title}</p>
          {section.rows.map((row) => (
            <ReviewRow key={`${section.title}-${row.label}`} label={row.label} value={row.value} />
          ))}
        </Card>
      ))}

      {view.signatures.length > 0 && (
        <Card className="space-y-4 rounded-[20px] border-[#d0d5dd] bg-white p-4">
          <p className="text-[21px] font-bold text-[#0c111d]">Captured signatures</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {view.signatures.map((signature) => (
              <div key={signature.id}>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-[#68738b]">
                  {signature.signature_type.replace(/_/g, ' ')}
                </p>
                <div className="relative h-28 rounded-[18px] border border-[#d8deec] bg-[#fcfcfd]">
                  <svg className="absolute inset-0 size-full">
                    <path
                      d={signaturePathData(signature.signature_data)}
                      fill="none"
                      stroke="#111827"
                      strokeLinecap="round"
                      strokeWidth="3"
                    />
                  </svg>
                </div>
                <p className="mt-2 text-xs font-semibold text-[#111827]">{signature.signer_name}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {view.photos.length > 0 && (
        <Card className="space-y-4 rounded-[20px] border-[#d0d5dd] bg-white p-4">
          <p className="text-[21px] font-bold text-[#0c111d]">Reference photos</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {view.photos.map((photo, index) => (
              <div key={`${photo.url}-${index}`}>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-[#68738b] capitalize">{photo.label}</p>
                <img
                  alt={photo.label}
                  className="h-44 w-full rounded-[18px] border border-[#d8deec] object-cover"
                  src={photo.url}
                />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
