import nodemailer from 'nodemailer'

// Any SMTP account works (e.g. a Gmail address with an app password, or Brevo's free plan).
// Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and MAIL_FROM in the Vercel project settings.
export const mailConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)

let transport: nodemailer.Transporter | undefined
function getTransport() {
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
  return transport
}

interface Mail {
  to: string
  subject: string
  text: string
  html?: string
  attachments?: { filename: string; content: Buffer | string }[]
}

export async function sendMail(m: Mail) {
  if (!mailConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`\n[mail:dev] to=${m.to}\nsubject: ${m.subject}\n${m.text}\n`)
      return
    }
    throw new Error('mail not configured')
  }
  await getTransport().sendMail({ from: process.env.MAIL_FROM ?? process.env.SMTP_USER, ...m })
}

export function linkEmail(name: string, purpose: 'activate' | 'reset', link: string) {
  const title = purpose === 'activate' ? 'تفعيل حسابك في نظام السكن الطلابي' : 'إعادة تعيين كلمة المرور'
  const action = purpose === 'activate' ? 'تفعيل الحساب وتعيين كلمة المرور' : 'تعيين كلمة مرور جديدة'
  const text = `مرحباً ${name}،\n\n${title}.\nافتح الرابط التالي خلال 60 دقيقة:\n${link}\n\nإذا لم تطلب ذلك فتجاهل هذه الرسالة.`
  const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:15px;line-height:1.8;color:#17221f">
  <p>مرحباً ${escapeHtml(name)}،</p><p>${title}.</p>
  <p><a href="${link}" style="display:inline-block;background:#0f5c4d;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none">${action}</a></p>
  <p style="color:#7c8985;font-size:13px">الرابط صالح لمدة 60 دقيقة. إذا لم تطلب ذلك فتجاهل هذه الرسالة.</p></div>`
  return { subject: title, text, html }
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`)
