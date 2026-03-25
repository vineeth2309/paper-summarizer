import nodemailer from "nodemailer";

function getBaseUrl() {
  return process.env.NEXTAUTH_URL || "http://localhost:3000";
}

export function buildPasswordResetUrl(token: string) {
  return `${getBaseUrl()}/reset-password/${token}`;
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = buildPasswordResetUrl(token);
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM || "paper-summarizer@local.dev";

  if (!host || !user || !pass) {
    console.info(`[password-reset] ${email} -> ${resetUrl}`);
    return {
      delivered: false,
      resetUrl
    };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass
    }
  });

  await transporter.sendMail({
    from,
    to: email,
    subject: "Reset your Paper Summarizer password",
    text: `Use this link to reset your password:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Use this link to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request this, you can ignore this email.</p>`
  });

  return {
    delivered: true,
    resetUrl
  };
}
