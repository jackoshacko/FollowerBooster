// client/src/components/CookieNotice.jsx
import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";

export default function CookieNotice() {
  const KEY = "cookie_consent_v1";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (!v) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  function accept() {
    try {
      localStorage.setItem(KEY, "accepted");
    } catch {}
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed bottom-3 left-0 right-0 z-[999] px-3">
      <div className="mx-auto max-w-[900px] rounded-2xl border border-white/10 bg-black/60 backdrop-blur p-4 shadow-soft">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-zinc-200">
            We use essential storage (e.g. localStorage/cookies) to keep you signed in and to secure
            payments. Learn more in{" "}
            <NavLink className="underline text-zinc-100" to="/privacy">
              Privacy Policy
            </NavLink>
            .
          </div>
          <div className="flex gap-2">
            <button
              onClick={accept}
              className="rounded-xl px-4 py-2 text-sm font-medium bg-white text-zinc-900 hover:bg-zinc-200"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
