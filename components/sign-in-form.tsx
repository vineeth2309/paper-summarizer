"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export function SignInForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError("");
        const result = await signIn("credentials", {
          email,
          name,
          redirect: false,
          callbackUrl: "/dashboard"
        });
        if (result?.error) {
          setError(result.error);
          setSubmitting(false);
          return;
        }
        window.location.href = "/dashboard";
      }}
    >
      <div className="space-y-2">
        <label className="text-sm text-mist" htmlFor="name">
          Name
        </label>
        <input
          id="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none transition focus:border-white/30"
          placeholder="Ada Researcher"
        />
      </div>
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
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-2xl bg-[#f0e6d8] px-4 py-3 text-sm font-semibold text-[#111111] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Signing in..." : "Continue"}
      </button>
      <p className="text-sm leading-6 text-mist">
        Local MVP mode creates the account on first sign-in with the submitted email. Add GitHub env vars to enable OAuth automatically.
      </p>
    </form>
  );
}
