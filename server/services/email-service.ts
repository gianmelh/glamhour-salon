import nodemailer from 'nodemailer'
import { config } from '../config.js'
import { ApiError } from '../errors.js'

function smtpConfigured() {
  return Boolean(config.SMTP_HOST && config.SMTP_PORT && config.SMTP_USER && config.SMTP_PASS && config.SMTP_FROM)
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function sendPasswordResetCode({
  code,
  email,
  name,
}: {
  code: string
  email: string
  name: string
}) {
  if (!smtpConfigured()) {
    if (config.NODE_ENV === 'production') {
      throw new ApiError(500, 'Password reset email is not configured.')
    }

    console.info(`[dev] Password reset code for ${email}: ${code}`)
    return
  }

  const safeName = escapeHtml(name)

  const transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS,
    },
  })

  await transporter.sendMail({
    from: config.SMTP_FROM,
    to: email,
    subject: 'Your Glamhour password reset code',
    text: `Hi ${name},\n\nYour Glamhour password reset code is ${code}.\n\nThis code expires in 10 minutes. If you did not request this, you can ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#172033">
        <h1 style="font-size:20px">Reset your Glamhour password</h1>
        <p>Hi ${safeName},</p>
        <p>Your verification code is:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>
        <p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>
      </div>
    `,
  })
}
