"use client";

import Link from "next/link";
import { useState } from "react";

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        setMessage("");

        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          return;
        }

        setSubmitting(true);
        const response = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ token, password })
        });

        const data = (await response.json()) as { error?: string };

        if (!response.ok) {
          setError(data.error ?? "Failed to reset password.");
          setSubmitting(false);
          return;
        }

        setMessage("Password updated. You can sign in with your new password.");
        setSubmitting(false);
      }}
    >
      <div className="space-y-2">
        <label className="text-sm text-mist" htmlFor="password">
          New password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={8}
          className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none transition focus:border-white/30"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm text-mist" htmlFor="confirmPassword">
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          minLength={8}
          className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none transition focus:border-white/30"
        />
      </div>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {message ? <p className="text-sm text-[#f4d4bc]">{message}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-2xl bg-[#f0e6d8] px-4 py-3 text-sm font-semibold text-[#111111] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Updating..." : "Reset password"}
      </button>
      <p className="text-sm text-mist">
        Ready to sign in?{" "}
        <Link href="/login" className="transition hover:text-white">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
