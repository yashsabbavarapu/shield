"use client";
import { useState, useTransition } from "react";
import { copyAction } from "@/lib/actions";
import type { Check } from "@/lib/types";
import { ReportView } from "./ReportClient";

export function CopyForm() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [check, setCheck] = useState<Check | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await copyAction(subject, body);
      if (r.ok) setCheck(r.data);
      else setError(r.error);
    });
  };

  return (
    <>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm">
          Subject
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5" />
        </label>
        <label className="block text-sm">
          Body (plain text or HTML)
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 font-mono text-sm" />
        </label>
        <button disabled={pending} className="rounded bg-gray-900 px-4 py-1.5 text-sm text-white disabled:opacity-50">{pending ? "Checking" : "Check copy"}</button>
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      </form>
      {check && <ReportView check={check} />}
    </>
  );
}
