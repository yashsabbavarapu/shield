"use client";
import { useState, useTransition } from "react";
import { addSuppressionAction, removeSuppressionAction } from "@/lib/actions";
import type { SuppressionEntry } from "@/lib/types";

export function SuppressionManager({ entries }: { entries: SuppressionEntry[] }) {
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("bounce");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await addSuppressionAction(email, reason);
      if (r.ok) setEmail("");
      else setError(r.error);
    });
  };
  const remove = (id: string) => {
    setError(null);
    start(async () => {
      const r = await removeSuppressionAction(id);
      if (!r.ok) setError(r.error);
    });
  };

  return (
    <>
      <form onSubmit={add} className="flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-64 rounded border border-gray-300 px-2 py-1.5" />
        </label>
        <label className="block text-sm">
          Reason
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 block rounded border border-gray-300 px-2 py-1.5">
            <option value="bounce">bounce</option>
            <option value="unsub">unsub</option>
            <option value="complaint">complaint</option>
          </select>
        </label>
        <button disabled={pending} className="rounded bg-gray-900 px-4 py-1.5 text-sm text-white disabled:opacity-50">Add</button>
      </form>
      {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
      {entries.some((e) => e.sample) && <p className="mt-4 text-xs text-gray-500">Rows marked sample are seeded sample data.</p>}
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-left text-xs uppercase text-gray-500">
              <th className="py-1 pr-3">Email</th>
              <th className="py-1 pr-3">Reason</th>
              <th className="py-1 pr-3">Added</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-gray-100">
                <td className="py-1.5 pr-3 break-all">{e.email}{e.sample && <span className="ml-2 text-xs text-gray-500">sample</span>}</td>
                <td className="py-1.5 pr-3">{e.reason}</td>
                <td className="py-1.5 pr-3 whitespace-nowrap text-gray-600">{e.added_at.slice(0, 10)}</td>
                <td className="py-1.5 text-right"><button disabled={pending} onClick={() => remove(e.id)} className="text-red-700 underline disabled:opacity-50">Remove</button></td>
              </tr>
            ))}
            {entries.length === 0 && <tr><td colSpan={4} className="py-3 text-gray-500">The suppression list is empty.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
