"use client";

import Link from "next/link";
import { useState } from "react";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [resetUrl, setResetUrl] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError("");
        setMessage("");
        setResetUrl("");

        const response = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ email })
        });

        const data = (await response.json()) as { error?: string; resetUrl?: string };

        if (!response.ok) {
          setError(data.error ?? "Failed to create reset link.");
          setSubmitting(false);
          return;
        }

        setMessage("If that email exists, a password reset link has been issued.");
        setResetUrl(data.resetUrl ?? "");
        setSubmitting(false);
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
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {message ? <p className="text-sm text-[#f4d4bc]">{message}</p> : null}
      {resetUrl ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-mist">
          Local dev reset link:{" "}
          <Link href={resetUrl} className="break-all text-white underline">
            {resetUrl}
          </Link>
        </p>
      ) : null}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-2xl bg-[#f0e6d8] px-4 py-3 text-sm font-semibold text-[#111111] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Sending..." : "Send reset link"}
      </button>
      <p className="text-sm text-mist">
        Remembered it?{" "}
        <Link href="/login" className="transition hover:text-white">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
