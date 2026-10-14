"use client";
import { useState, useTransition } from "react";
import { listAction } from "@/lib/actions";
import { extractEmails } from "@/lib/csv";
import type { Check } from "@/lib/types";
import { ReportView } from "./ReportClient";

export function ListForm() {
  const [emails, setEmails] = useState<string[]>([]);
  const [file, setFile] = useState("");
  const [check, setCheck] = useState<Check | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onFile = async (f: File | undefined) => {
    setCheck(null);
    setError(null);
    if (!f) return;
    setFile(f.name);
    setEmails(extractEmails(await f.text()));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await listAction(emails);
      if (r.ok) setCheck(r.data);
      else setError(r.error);
    });
  };

  return (
    <>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm">
          CSV file (an email column, or one address per row)
          <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(e) => onFile(e.target.files?.[0])} className="mt-1 block text-sm" />
        </label>
        {file && <p className="text-sm text-gray-600">{file}: {emails.length} address{emails.length === 1 ? "" : "es"} read.</p>}
        <button disabled={pending || emails.length === 0} className="rounded bg-gray-900 px-4 py-1.5 text-sm text-white disabled:opacity-50">{pending ? "Checking" : "Check list"}</button>
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      </form>
      {check && (
        <>
          <ReportView check={check} />
          <h3 className="mt-6 text-sm font-semibold">Per address</h3>
          <p className="text-xs text-gray-500">Suppression hits can include sample rows from the seeded list.</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-300 text-left text-xs uppercase text-gray-500">
                  <th className="py-1 pr-3">Row</th>
                  <th className="py-1 pr-3">Email</th>
                  <th className="py-1 pr-3">Format</th>
                  <th className="py-1 pr-3">Role</th>
                  <th className="py-1 pr-3">Duplicate</th>
                  <th className="py-1">Suppressed</th>
                </tr>
              </thead>
              <tbody>
                {(check.rows ?? []).map((r, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-1 pr-3 text-gray-500">{i + 1}</td>
                    <td className="py-1 pr-3 break-all">{r.email || "(blank)"}</td>
                    <td className={`py-1 pr-3 ${r.valid ? "" : "text-red-700"}`}>{r.valid ? "ok" : "invalid"}</td>
                    <td className={`py-1 pr-3 ${r.role ? "text-amber-700" : ""}`}>{r.role ? "role" : ""}</td>
                    <td className={`py-1 pr-3 ${r.duplicate ? "text-amber-700" : ""}`}>{r.duplicate ? "duplicate" : ""}</td>
                    <td className={`py-1 ${r.suppressed ? "text-red-700" : ""}`}>{r.suppressed ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
