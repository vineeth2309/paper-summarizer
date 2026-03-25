import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  const user = await prisma.user.findFirst({
    where: {
      email: session.user.email
    },
    select: {
      name: true,
      email: true,
      image: true
    }
  });

  return <DashboardShell user={user ?? session.user}>{children}</DashboardShell>;
}
