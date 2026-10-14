"use client";
import { useState, useTransition } from "react";
import { domainAction } from "@/lib/actions";
import type { Check } from "@/lib/types";
import { ReportView } from "./ReportClient";

export function DomainForm() {
  const [domain, setDomain] = useState("");
  const [check, setCheck] = useState<Check | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await domainAction(domain);
      if (r.ok) setCheck(r.data);
      else setError(r.error);
    });
  };

  return (
    <>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          Sending domain
          <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" className="mt-1 block w-64 rounded border border-gray-300 px-2 py-1.5" />
        </label>
        <button disabled={pending} className="rounded bg-gray-900 px-4 py-1.5 text-sm text-white disabled:opacity-50">{pending ? "Looking up" : "Check domain"}</button>
      </form>
      {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
      {check && <ReportView check={check} />}
    </>
  );
}
