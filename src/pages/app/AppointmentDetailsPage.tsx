import { CalendarDays, ChevronLeft, Clock3, DollarSign, MapPin, UserRound } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Avatar, Badge, Button, Card, DataSourceNotice, ErrorState, LoadingState, MutationError, PageTitle, ScreenSection } from '../../components'
import { useAppointment } from '../../hooks/useGlamhourData'
import { useMutation } from '../../hooks/useMutation'
import { appointmentService, appointmentStatus, formatDate, formatMoney, formatTime } from '../../lib/format'
import { glamhourApi } from '../../services/glamhour-api'

export function AppointmentDetailsPage() {
  const navigate = useNavigate()
  const { appointmentId = '' } = useParams()
  const appointment = useAppointment(appointmentId)
  const mutation = useMutation((status: string) => glamhourApi.updateAppointmentStatus(appointmentId, status))
  if (appointment.loading) return <LoadingState label="Loading booking details..." />
  if (!appointment.data) return <ErrorState description={appointment.error?.message ?? 'Appointment not found'} onRetry={appointment.retry} />
  const data = appointment.data
  const status = appointmentStatus(data.status_code)
  const tone = status === 'Completed' ? 'success' : status === 'In progress' ? 'primary' : status === 'Canceled' ? 'danger' : 'warning'
  const service = data.services?.[0]
  const updateStatus = async (next: string) => {
    const updated = await mutation.mutate(next)
    appointment.setData((current) => current ? { ...current, ...updated } : updated)
  }
  return <div className="space-y-5"><DataSourceNotice visible={appointment.isFallback} /><button className="inline-flex items-center gap-1 text-xs font-semibold text-primary" onClick={() => navigate(-1)} type="button"><ChevronLeft className="size-4" /> Back</button><PageTitle title="Booking details" subtitle="Review and manage this salon appointment." /><Card className="text-center" tone="lavender"><Avatar className="mx-auto" name={data.client_name ?? 'Client'} size="lg" /><h2 className="mt-3 text-lg font-semibold">{data.client_name ?? 'Client'}</h2><p className="text-xs text-muted">{appointmentService(data)}</p><Badge className="mt-3" tone={tone}>{status}</Badge></Card><ScreenSection title="Appointment information"><Card className="space-y-4"><Detail icon={<CalendarDays />} label="Date" value={formatDate(data.starts_at)} /><Detail icon={<Clock3 />} label="Time" value={formatTime(data.starts_at)} /><Detail icon={<UserRound />} label="Professional" value={data.professional_name ?? 'Professional'} /><Detail icon={<DollarSign />} label="Service cost" value={formatMoney(service?.unit_price_minor ?? 0)} /><Detail icon={<MapPin />} label="Location" value="Glow Salon" /></Card></ScreenSection><MutationError error={mutation.error} /><div className="grid gap-3">{data.status_code === 'scheduled' && <Button fullWidth loading={mutation.loading} onClick={() => updateStatus('coming_up')}>Mark as coming up</Button>}{data.status_code === 'coming_up' && <Button fullWidth loading={mutation.loading} onClick={() => updateStatus('completed')}>Complete service</Button>}{data.status_code === 'in_progress' && <Button fullWidth loading={mutation.loading} onClick={() => updateStatus('completed')}>Complete service</Button>}<Button fullWidth variant="outline">Reschedule appointment</Button>{!['completed', 'canceled'].includes(data.status_code) && <Button fullWidth loading={mutation.loading} onClick={() => updateStatus('canceled')} variant="ghost">Cancel appointment</Button>}</div></div>
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-md bg-lavender text-primary [&>svg]:size-4">{icon}</span><div><p className="text-[11px] text-muted">{label}</p><p className="text-xs font-semibold">{value}</p></div></div>
}
