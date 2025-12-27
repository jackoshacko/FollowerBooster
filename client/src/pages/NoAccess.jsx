// client/src/pages/NoAccess.jsx
import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function NoAccess() {
  const loc = useLocation();
  const from = loc.state?.from || "/admin";

  return (
    <div className="p-6">
      <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-black/30 p-6">
        <div className="text-2xl font-semibold">Access denied</div>

        <div className="mt-2 text-sm text-white/70">
          Nemaš admin permisije za{" "}
          <span className="rounded bg-white/5 px-2 py-0.5 font-mono text-white/90">
            {from}
          </span>
          .
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            to="/dashboard"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            Nazad na Dashboard
          </Link>
          <Link
            to="/wallet"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            Idi na Wallet
          </Link>
          <Link
            to="/login"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            Promeni nalog
          </Link>
        </div>

        <div className="mt-4 text-xs text-white/50">
          Ako misliš da je greška, uloguj se kao admin.
        </div>
      </div>
    </div>
  );
}
