import { verdict } from "@/lib/checks";
import type { Check, Status } from "@/lib/types";

const COLOR: Record<Status, string> = { pass: "text-green-700", warn: "text-amber-700", fail: "text-red-700" };

export function ReportView({ check }: { check: Check }) {
  const deducted = check.findings.filter((f) => f.deduction > 0);
  return (
    <section className="mt-6" aria-live="polite">
      <h2 className="text-lg font-semibold">
        Score {check.score} / 100 <span className="text-sm font-normal text-gray-600">({verdict(check.score)})</span>
      </h2>
      <p className="mt-1 text-xs text-gray-500">
        {check.subject} · starts at 100, minus {deducted.length ? deducted.map((f) => `${f.deduction} (${f.check})`).join(", ") : "nothing"}
      </p>
      {check.incomplete && <p className="mt-2 text-sm text-amber-700">Some lookups failed, so this score covers only the checks that ran. Run it again to retry.</p>}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-left text-xs uppercase text-gray-500">
              <th className="py-1 pr-3">Check</th>
              <th className="py-1 pr-3">Result</th>
              <th className="py-1 pr-3 text-right">Points</th>
              <th className="py-1">Reason</th>
            </tr>
          </thead>
          <tbody>
            {check.findings.map((f, i) => (
              <tr key={i} className="border-b border-gray-100 align-top">
                <td className="py-2 pr-3 font-medium">{f.check}</td>
                <td className={`py-2 pr-3 ${COLOR[f.status]}`}>{f.unknown ? "unknown" : f.status}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{f.deduction ? `-${f.deduction}` : "0"}</td>
                <td className="py-2">
                  {f.detail}
                  {f.records && f.records.length > 0 && (
                    <ul className="mt-1 space-y-1">
                      {f.records.map((r, j) => (
                        <li key={j} className="break-all rounded bg-gray-50 px-2 py-1 font-mono text-xs">{r}</li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
