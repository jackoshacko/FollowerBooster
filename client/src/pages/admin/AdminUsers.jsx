import React, { useEffect, useState } from "react";
import { api } from "../../lib/api.js"; // ✅ FIXED PATH

export default function AdminUsers() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState([]);
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    try {
      const data = await api.get(
        `/admin/users?q=${encodeURIComponent(q)}`
      );
      setUsers(data || []);
    } catch (e) {
      setErr(e?.message || "Failed to load users");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function adjust(userId) {
    const raw = prompt("Adjust balance by amount (example: 10 or -5):");
    if (!raw) return;

    const amount = Number(raw);
    if (!Number.isFinite(amount)) {
      alert("Invalid number");
      return;
    }

    try {
      await api.post(`/admin/users/${userId}/adjust-balance`, { amount });
      await load();
      alert("Updated ✅");
    } catch (e) {
      alert(e?.message || "Failed to update");
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-xl font-semibold">Admin Users</h1>

        <div className="flex gap-2">
          <input
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none"
            placeholder="Search by email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            onClick={load}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500"
          >
            Search
          </button>
        </div>
      </div>

      {/* Error */}
      {err && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
          {err}
        </div>
      )}

      {/* Users list */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40">
        <div className="border-b border-zinc-800 px-4 py-3 text-sm text-zinc-400">
          {users.length} users
        </div>

        <div className="divide-y divide-zinc-800">
          {users.map((u) => (
            <div
              key={u._id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div>
                <div className="text-sm font-semibold">{u.email}</div>
                <div className="text-xs text-zinc-400">
                  role: {u.role} • balance: {u.balance} EUR
                </div>
              </div>

              <button
                onClick={() => adjust(u._id)}
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-semibold hover:bg-zinc-900"
              >
                Adjust balance
              </button>
            </div>
          ))}

          {users.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-zinc-400">
              No users found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
