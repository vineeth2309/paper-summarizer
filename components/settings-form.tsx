"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function SettingsForm({
  initialName,
  email,
  providers,
  hasPassword
}: {
  initialName: string;
  email: string;
  providers: string[];
  hasPassword: boolean;
}) {
  const [name, setName] = useState(initialName);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isProfilePending, startProfileTransition] = useTransition();
  const [isPasswordPending, startPasswordTransition] = useTransition();
  const router = useRouter();

  const saveProfile = () => {
    setProfileError("");
    setProfileMessage("");

    startProfileTransition(async () => {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name })
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setProfileError(data.error ?? "Failed to save settings.");
        return;
      }

      setProfileMessage("Profile saved.");
      router.refresh();
    });
  };

  const changePassword = () => {
    setPasswordError("");
    setPasswordMessage("");

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    startPasswordTransition(async () => {
      const response = await fetch("/api/settings/password", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setPasswordError(data.error ?? "Failed to change password.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Password updated.");
    });
  };

  return (
    <div className="grid gap-4 p-4 xl:grid-cols-[0.72fr_1.28fr]">
      <section className="rounded-[24px] border border-white/8 bg-[#171717] p-6">
        <p className="text-sm uppercase tracking-[0.24em] text-mist">Settings</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Manage your account.</h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-mist">
          Update your display name, review sign-in methods, and change your password if this account uses credentials auth.
        </p>

        <div className="mt-6 rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-mist">Sign-in methods</p>
          <p className="mt-3 text-sm leading-7 text-[#e6ddd1]">
            {providers.length ? providers.join(", ") : hasPassword ? "Email and password" : "No sign-in methods detected"}
          </p>
        </div>

        <div className="mt-4 rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-mist">Password reset</p>
          <p className="mt-3 text-sm leading-7 text-[#e6ddd1]">
            {hasPassword
              ? "Forgot-password links are available from the sign-in screen and expire automatically."
              : "This account does not currently use password sign-in, so password reset is not applicable."}
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="rounded-[24px] border border-white/8 bg-[#171717] p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-mist">Profile</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.18em] text-mist">Display name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition focus:border-white/30"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.18em] text-mist">Email</span>
              <input
                value={email}
                readOnly
                className="w-full rounded-[18px] border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-mist outline-none"
              />
            </label>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm">
              {profileError ? <p className="text-red-300">{profileError}</p> : null}
              {profileMessage ? <p className="text-[#f4d4bc]">{profileMessage}</p> : null}
            </div>
            <button
              type="button"
              onClick={saveProfile}
              disabled={isProfilePending || !name.trim()}
              className="rounded-2xl bg-[#f0e6d8] px-5 py-3 text-sm font-semibold text-[#111111] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isProfilePending ? "Saving..." : "Save profile"}
            </button>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/8 bg-[#171717] p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-mist">Change password</p>
          {hasPassword ? (
            <>
              <div className="mt-5 grid gap-4">
                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.18em] text-mist">Current password</span>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    className="w-full rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition focus:border-white/30"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.18em] text-mist">New password</span>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    minLength={8}
                    className="w-full rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition focus:border-white/30"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.18em] text-mist">Confirm new password</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    minLength={8}
                    className="w-full rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition focus:border-white/30"
                  />
                </label>
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                <div className="text-sm">
                  {passwordError ? <p className="text-red-300">{passwordError}</p> : null}
                  {passwordMessage ? <p className="text-[#f4d4bc]">{passwordMessage}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={changePassword}
                  disabled={isPasswordPending || !currentPassword || !newPassword || !confirmPassword}
                  className="rounded-2xl bg-[#f0e6d8] px-5 py-3 text-sm font-semibold text-[#111111] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPasswordPending ? "Updating..." : "Update password"}
                </button>
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm leading-7 text-mist">
              This account does not currently use password sign-in. If you signed up with OAuth only, password changes are not available.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
