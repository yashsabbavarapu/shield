import { listAudit } from "@/lib/core";

export const dynamic = "force-dynamic";

export default async function LogPage() {
  const log = await listAudit();
  return (
    <div>
      <h1 className="text-xl font-semibold">Log</h1>
      <p className="mb-4 mt-1 text-sm text-gray-700">Append-only record of checks and suppression changes, newest first.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-left text-xs uppercase text-gray-500">
              <th className="py-1 pr-3">Time</th>
              <th className="py-1 pr-3">Action</th>
              <th className="py-1">Summary</th>
            </tr>
          </thead>
          <tbody>
            {log.map((e) => (
              <tr key={e.id} className="border-b border-gray-100">
                <td className="py-1.5 pr-3 whitespace-nowrap text-gray-600">{e.at.replace("T", " ").slice(0, 19)}</td>
                <td className="py-1.5 pr-3 whitespace-nowrap">{e.action}</td>
                <td className="py-1.5 break-all">{e.summary}</td>
              </tr>
            ))}
            {log.length === 0 && <tr><td colSpan={3} className="py-3 text-gray-500">Nothing logged yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
