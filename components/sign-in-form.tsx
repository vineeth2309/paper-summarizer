"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";

export function SignInForm({
  googleEnabled = false,
  githubEnabled = false
}: {
  googleEnabled?: boolean;
  githubEnabled?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="space-y-5">
      {(googleEnabled || githubEnabled) ? (
        <div className="space-y-3">
          {googleEnabled ? (
            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
            >
              Continue with Google
            </button>
          ) : null}
          {githubEnabled ? (
            <button
              type="button"
              onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
            >
              Continue with GitHub
            </button>
          ) : null}
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-mist">
            <div className="h-px flex-1 bg-white/10" />
            <span>or use email</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>
        </div>
      ) : null}

      <form
        className="space-y-5"
        onSubmit={async (event) => {
          event.preventDefault();
          setSubmitting(true);
          setError("");
          const result = await signIn("credentials", {
            email,
            password,
            redirect: false,
            callbackUrl: "/dashboard"
          });

          if (result?.error) {
            setError("Invalid email or password.");
            setSubmitting(false);
            return;
          }

          window.location.href = "/dashboard";
        }}
      >
        <div className="space-y-2">
          <label className="text-sm text-mist" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none transition focus:border-white/30"
            placeholder="you@example.com"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-mist" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none transition focus:border-white/30"
            placeholder="Minimum 8 characters"
          />
        </div>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-2xl bg-[#f0e6d8] px-4 py-3 text-sm font-semibold text-[#111111] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Signing in..." : "Sign in"}
        </button>
        <div className="flex items-center justify-between text-sm text-mist">
          <Link href="/register" className="transition hover:text-white">
            Create account
          </Link>
          <Link href="/forgot-password" className="transition hover:text-white">
            Forgot password?
          </Link>
        </div>
      </form>
    </div>
  );
}
