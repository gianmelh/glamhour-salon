import { jsPDF } from 'jspdf'

interface BookingTicketPdfInput {
  confirmationCode: string
  salonName: string
  salonLogoUrl?: string | null
  clientName: string
  serviceName: string
  date: string
  time: string
  specialistName: string
  location: string
}

function salonInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

async function imageAsPngDataUrl(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Salon logo could not be loaded.')

  const objectUrl = URL.createObjectURL(await response.blob())
  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = objectUrl
    await image.decode()

    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Salon logo could not be rendered.')

    const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight)
    const width = image.naturalWidth * scale
    const height = image.naturalHeight * scale
    context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function createBookingTicketPdf(input: BookingTicketPdfInput) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 48
  const contentWidth = pageWidth - margin * 2
  let logoDataUrl: string | null = null

  if (input.salonLogoUrl) {
    try {
      logoDataUrl = await imageAsPngDataUrl(input.salonLogoUrl)
    } catch {
      logoDataUrl = null
    }
  }

  doc.setFillColor(245, 243, 255)
  doc.roundedRect(margin, 40, contentWidth, 104, 12, 12, 'F')

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', margin + 18, 60, 64, 64, undefined, 'FAST')
  } else {
    doc.setFillColor(124, 58, 237)
    doc.circle(margin + 50, 92, 32, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text(salonInitials(input.salonName), margin + 50, 98, { align: 'center' })
  }

  doc.setTextColor(16, 24, 39)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(input.salonName, margin + 100, 83)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(91, 33, 182)
  doc.setFontSize(10)
  doc.text('APPOINTMENT CONFIRMATION', margin + 100, 104)

  doc.setTextColor(16, 24, 39)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Your appointment is confirmed', margin, 184)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(107, 114, 128)
  doc.setFontSize(10)
  doc.text('Keep this ticket for your records.', margin, 202)

  doc.setDrawColor(221, 214, 254)
  doc.setFillColor(250, 250, 255)
  doc.roundedRect(margin, 226, contentWidth, 70, 8, 8, 'FD')
  doc.setTextColor(107, 114, 128)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('CONFIRMATION CODE', pageWidth / 2, 250, { align: 'center' })
  doc.setTextColor(76, 29, 149)
  doc.setFontSize(22)
  doc.text(input.confirmationCode, pageWidth / 2, 278, { align: 'center' })

  const details = [
    ['Client', input.clientName],
    ['Service', input.serviceName],
    ['Date', input.date],
    ['Time', input.time],
    ['Specialist', input.specialistName],
    ['Location', input.location || input.salonName],
  ]
  let y = 338
  details.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(107, 114, 128)
    doc.setFontSize(9)
    doc.text(label.toUpperCase(), margin, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(16, 24, 39)
    doc.setFontSize(11)
    doc.text(doc.splitTextToSize(value, contentWidth - 150), margin + 150, y)
    doc.setDrawColor(238, 238, 244)
    doc.line(margin, y + 16, pageWidth - margin, y + 16)
    y += 48
  })

  doc.setTextColor(139, 92, 246)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Powered by Glamhour', pageWidth / 2, 738, { align: 'center' })

  return doc
}

export async function downloadBookingTicketPdf(input: BookingTicketPdfInput) {
  const doc = await createBookingTicketPdf(input)
  doc.save(`${input.confirmationCode || 'booking'}-appointment.pdf`)
}
