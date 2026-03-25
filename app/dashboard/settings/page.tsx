import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsForm } from "@/components/settings-form";

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user?.id || !session.user.email) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      accounts: {
        select: {
          provider: true
        }
      }
    }
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <SettingsForm
      initialName={user.name ?? (user.email ?? session.user.email).split("@")[0]}
      email={user.email ?? session.user.email}
      providers={[
        ...new Set(
          user.accounts.map((account) => {
            if (account.provider === "credentials") {
              return "Email and password";
            }

            if (account.provider === "google") {
              return "Google";
            }

            if (account.provider === "github") {
              return "GitHub";
            }

            return account.provider;
          })
        )
      ]}
      hasPassword={Boolean(user.passwordHash)}
    />
  );
}
