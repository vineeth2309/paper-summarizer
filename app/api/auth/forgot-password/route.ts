import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/mailer";
import { generatePasswordResetToken, hashPasswordResetToken } from "@/lib/password";

const forgotPasswordSchema = z.object({
  email: z.string().email()
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = forgotPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email }
  });

  if (!user?.passwordHash) {
    return NextResponse.json({ ok: true });
  }

  const token = generatePasswordResetToken();
  const tokenHash = hashPasswordResetToken(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({
      where: { userId: user.id }
    }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt
      }
    })
  ]);

  const delivery = await sendPasswordResetEmail(user.email!, token);
  return NextResponse.json({
    ok: true,
    resetUrl: delivery.delivered ? undefined : delivery.resetUrl
  });
}
