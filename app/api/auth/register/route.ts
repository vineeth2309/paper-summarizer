import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

const registerSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(128)
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid registration payload." }, { status: 400 });
  }

  const { name, email, password } = parsed.data;
  const existing = await prisma.user.findUnique({
    where: { email }
  });

  if (existing?.passwordHash) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  if (existing && !existing.passwordHash) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: existing.name ?? name.trim(),
        passwordHash: await hashPassword(password)
      }
    });

    return NextResponse.json({ ok: true });
  }

  await prisma.user.create({
    data: {
      name: name.trim(),
      email,
      passwordHash: await hashPassword(password)
    }
  });

  return NextResponse.json({ ok: true });
}
