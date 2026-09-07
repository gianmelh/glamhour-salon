import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, Copy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, Card, DataSourceNotice, ErrorState, LoadingState } from '../../components'
import { useSalon, useSettings } from '../../hooks/useGlamhourData'
import { phoneForUrl, publicBookingShareSettings } from '../../lib/public-booking-settings'
import { publicBookingShareMessage, publicBookingUrl } from '../../lib/public-booking-url'

type CopyState = 'idle' | 'success' | 'error'
type ShareChannel = 'WhatsApp' | 'SMS / Message' | 'Facebook' | 'Instagram'

function isIos() {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

async function writeClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-999px'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)
  if (!copied) throw new Error('Clipboard fallback failed')
}

function externalUrl(url: string) {
  const value = url.trim()
  if (!value) return ''
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

export function SharePage() {
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const [configurationPrompt, setConfigurationPrompt] = useState<{ channel: ShareChannel; message: string } | null>(null)
  const salon = useSalon()
  const settings = useSettings()
  const bookingUrl = useMemo(() => salon.data ? publicBookingUrl(salon.data.slug) : '', [salon.data])
  const shareSettings = publicBookingShareSettings(settings.data?.settings_json)

  useEffect(() => {
    if (copyState === 'idle') return
    const timer = window.setTimeout(() => setCopyState('idle'), 2600)
    return () => window.clearTimeout(timer)
  }, [copyState])

  if (salon.loading || settings.loading) return <LoadingState label="Loading salon link..." />
  if (!salon.data || !settings.data) return <ErrorState description={salon.error?.message ?? settings.error?.message ?? 'Salon could not be loaded'} onRetry={() => { salon.retry(); settings.retry() }} />

  const copyLink = async () => {
    setConfigurationPrompt(null)
    try {
      await writeClipboard(bookingUrl)
      setCopyState('success')
    } catch {
      setCopyState('error')
    }
  }

  const shareMessage = publicBookingShareMessage(bookingUrl)
  const encodedMessage = encodeURIComponent(shareMessage)
  const whatsappPhone = phoneForUrl(shareSettings.whatsappPhone)
  const smsPhone = phoneForUrl(shareSettings.smsPhone || shareSettings.whatsappPhone)
  const facebookUrl = externalUrl(shareSettings.facebookUrl)
  const instagramUrl = externalUrl(shareSettings.instagramUrl)
  const requireConfiguration = (channel: ShareChannel, value: string, message: string) => {
    if (value) return true
    setCopyState('idle')
    setConfigurationPrompt({ channel, message })
    return false
  }

  const shareOptions: Array<{
    label: ShareChannel
    icon: string
    onClick: () => void | Promise<void>
  }> = [
    {
      label: 'WhatsApp',
      icon: '/Glamhour - Assets/Salon link/Icon-4.svg',
      onClick: () => {
        if (!requireConfiguration('WhatsApp', whatsappPhone, 'Add your WhatsApp number in Public booking settings to use this option.')) return
        window.open(`https://wa.me/${whatsappPhone}?text=${encodedMessage}`, '_blank', 'noopener,noreferrer')
      },
    },
    {
      label: 'SMS / Message',
      icon: '/Glamhour - Assets/Salon link/Icon-3.svg',
      onClick: () => {
        if (!requireConfiguration('SMS / Message', smsPhone, 'Add your SMS / Message number in Public booking settings to use this option.')) return
        window.location.href = `sms:${smsPhone}${isIos() ? '&' : '?'}body=${encodedMessage}`
      },
    },
    {
      label: 'Facebook',
      icon: '/Glamhour - Assets/Salon link/Icon-2.svg',
      onClick: () => {
        if (!requireConfiguration('Facebook', facebookUrl, 'Add your Facebook link in Public booking settings to use this option.')) return
        window.open(facebookUrl, '_blank', 'noopener,noreferrer')
      },
    },
    {
      label: 'Instagram',
      icon: '/Glamhour - Assets/Salon link/Icon-1.svg',
      onClick: async () => {
        if (!requireConfiguration('Instagram', instagramUrl, 'Add your Instagram link in Public booking settings to use this option.')) return
        await copyLink()
        window.open(instagramUrl, '_blank', 'noopener,noreferrer')
      },
    },
  ]

  return (
    <div className="min-h-full bg-[#f2f5ff] px-4 pb-5 pt-3">
      <DataSourceNotice visible={salon.isFallback} />
      <header className="mb-5">
        <div className="mb-2 flex items-center gap-1">
          <button aria-label="Back" className="grid size-7 place-items-center rounded-full text-[#101827]" onClick={() => window.history.back()} type="button">
            <ChevronLeft className="size-5" />
          </button>
          <h1 className="text-[19px] font-bold leading-tight text-[#101827]">Salon link</h1>
        </div>
        <p className="max-w-[285px] text-[11px] leading-4 text-[#596275]">Share your booking link with your clients across social media.</p>
      </header>

      <Card className="border-0 bg-[#eee9ff] p-4 shadow-none">
        <div className="flex items-center gap-2">
          <img alt="" className="size-4" src="/Glamhour - Assets/Salon link/Icon-6.svg" />
          <p className="text-[12px] font-extrabold text-[#101827]">Your Booking Link</p>
        </div>
        <p className="mt-2 max-w-[250px] text-[10px] font-medium leading-4 text-[#596275]">Share this link with clients so they can book appointments directly online.</p>
        <div className="mt-4 flex min-h-10 items-center gap-2 rounded-md bg-white px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-[10px] font-bold text-[#101827]">{bookingUrl.replace(/^https?:\/\//, '')}</span>
          <Button className="min-h-7 rounded-[5px] px-3 text-[10px]" onClick={copyLink} size="sm" type="button">
            <Copy className="size-3" /> Copy
          </Button>
        </div>
        {copyState === 'success' && <p className="mt-2 text-[10px] font-semibold text-[#22a06b]">Link copied successfully</p>}
        {copyState === 'error' && <p className="mt-2 text-[10px] font-semibold text-[#e05252]">Could not copy, please try again.</p>}
      </Card>

      <div className="mt-4 space-y-3">
        {shareOptions.map((option) => (
          <div className="space-y-2" key={option.label}>
            <button className="flex min-h-[58px] w-full flex-col items-center justify-center rounded-lg bg-white text-center shadow-card" onClick={option.onClick} type="button">
              <img alt="" className="size-4" src={option.icon} />
              <span className="mt-1 text-[10px] font-extrabold text-[#101827]">{option.label}</span>
            </button>
            {configurationPrompt?.channel === option.label && (
              <div className="rounded-lg border border-[#ded3ff] bg-white p-3 shadow-card">
                <p className="text-[11px] font-semibold leading-4 text-[#596275]">{configurationPrompt.message}</p>
                <Link className="mt-2 inline-flex min-h-8 items-center justify-center rounded-md bg-[#7c3aed] px-3 text-[10px] font-bold text-white" to="/app/settings?publicBooking=1#public-booking">
                  Go to settings
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 flex gap-3 rounded-lg bg-white p-3 shadow-card">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#eee9ff] text-[#7c3aed]">
          <img alt="" className="size-4" src="/Glamhour - Assets/Salon link/Icon.svg" />
        </span>
        <div>
          <p className="text-[11px] font-extrabold text-[#101827]">Pro Tip</p>
          <p className="mt-1 text-[10px] font-medium leading-4 text-[#596275]">Add this link to your Instagram Bio and Facebook &quot;Book Now&quot; button to make it easier for clients to find you.</p>
        </div>
      </div>
    </div>
  )
}
