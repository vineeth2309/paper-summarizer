import Link from "next/link";
import { SignInForm } from "@/components/sign-in-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-stretch justify-stretch px-2 py-2 md:px-3 md:py-3">
      <div className="grid w-full overflow-hidden rounded-[32px] border border-white/10 bg-[#151515]/95 shadow-halo lg:grid-cols-[0.95fr_1.05fr]">
        <section className="border-b border-white/10 bg-gradient-to-br from-[#1d1d1d] to-[#121212] p-8 lg:border-b-0 lg:border-r">
          <p className="mb-6 text-sm uppercase tracking-[0.24em] text-mist">Paper Summarizer</p>
          <h1 className="max-w-md text-4xl font-semibold leading-tight text-white">Sign in to your private research workspace.</h1>
          <p className="mt-5 max-w-md text-sm leading-7 text-mist">
            Import papers, keep a persistent summary history, revisit prior reading sessions, and compare documents from the embedding map.
          </p>
          <Link href="/" className="mt-10 inline-flex text-sm text-[#f4d4bc] transition hover:text-white">
            Back to landing page
          </Link>
        </section>
        <section className="p-8">
          <SignInForm />
        </section>
      </div>
    </main>
  );
}
