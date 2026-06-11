/**
 * Phase M / WS-A4 — transactional email (verification + password reset).
 *
 * Provider: Resend (https://resend.com) via plain HTTPS — no SDK dependency.
 * STUB MODE: until RESEND_API_KEY is set, sends are logged (with the action link)
 * instead of delivered, so the full flow is exercisable in dev today and goes live
 * the moment the key lands in .env. EMAIL_FROM defaults to Resend's shared
 * onboarding sender; swap to a verified domain sender before launch.
 */

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailArgs): Promise<{ sent: boolean; stubbed: boolean }> {
  if (!isEmailConfigured()) {
    const link = html.match(/href="([^"]+)"/)?.[1] ?? "(no link)";
    console.log(`[email:STUB] to=${to} subject="${subject}" (RESEND_API_KEY unset — not delivered)`);
    console.log(`[email:STUB] action-link: ${link}`);
    return { sent: false, stubbed: true };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "ReciPal <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[email] Resend send failed (${res.status}): ${body.slice(0, 300)}`);
    return { sent: false, stubbed: false };
  }
  return { sent: true, stubbed: false };
}

const BRAND = `font-family:Inter,system-ui,sans-serif;color:#1a1f35;max-width:480px;margin:0 auto;padding:24px`;
const BUTTON = `display:inline-block;background:linear-gradient(145deg,#34c759,#16a34a);color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:12px;margin:18px 0`;

export function verificationEmail(link: string): { subject: string; html: string } {
  return {
    subject: "Verify your ReciPal email",
    html: `<div style="${BRAND}">
      <h2>Welcome to ReciPal 🍳</h2>
      <p>Tap the button below to verify your email address. This link expires in 24 hours.</p>
      <a href="${link}" style="${BUTTON}">Verify my email</a>
      <p style="color:#697384;font-size:13px">If you didn't create a ReciPal account, you can ignore this email.</p>
    </div>`,
  };
}

export function passwordResetEmail(link: string): { subject: string; html: string } {
  return {
    subject: "Reset your ReciPal password",
    html: `<div style="${BRAND}">
      <h2>Password reset</h2>
      <p>Tap the button below to choose a new password. This link expires in 1 hour.</p>
      <a href="${link}" style="${BUTTON}">Reset password</a>
      <p style="color:#697384;font-size:13px">If you didn't request this, you can safely ignore it — your password is unchanged.</p>
    </div>`,
  };
}
