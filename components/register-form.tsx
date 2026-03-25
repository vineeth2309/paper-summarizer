"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";

export function RegisterForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");

        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          return;
        }

        setSubmitting(true);

        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ name, email, password })
        });

        const data = (await response.json()) as { error?: string };

        if (!response.ok) {
          setError(data.error ?? "Failed to create account.");
          setSubmitting(false);
          return;
        }

        await signIn("credentials", {
          email,
          password,
          redirect: false,
          callbackUrl: "/dashboard"
        });

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
          required
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
          minLength={8}
          className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none transition focus:border-white/30"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm text-mist" htmlFor="confirmPassword">
          Confirm password
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
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-2xl bg-[#f0e6d8] px-4 py-3 text-sm font-semibold text-[#111111] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Creating account..." : "Create account"}
      </button>
      <p className="text-sm text-mist">
        Already have an account?{" "}
        <Link href="/login" className="transition hover:text-white">
          Sign in
        </Link>
      </p>
    </form>
  );
}
