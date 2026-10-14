import { SuppressionManager } from "@/components/SuppressionManager";
import { listSuppressions } from "@/lib/core";

export const dynamic = "force-dynamic";

export default async function SuppressionsPage() {
  const entries = await listSuppressions();
  return (
    <div>
      <h1 className="text-xl font-semibold">Suppressions</h1>
      <p className="mb-4 mt-1 text-sm text-gray-700">Addresses that must not be sent to. The list check matches against these.</p>
      <SuppressionManager entries={entries} />
    </div>
  );
}
