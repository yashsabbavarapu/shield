import { ListForm } from "@/components/ListForm";
import { WEIGHTS } from "@/lib/checks";

export default function ListPage() {
  const w = WEIGHTS.list;
  return (
    <div>
      <h1 className="text-xl font-semibold">List check</h1>
      <p className="mb-4 mt-1 text-sm text-gray-700">Upload a CSV. Each address is checked for format, role names, repeats and the suppression list.</p>
      <ListForm />
      <details className="mt-8 text-sm text-gray-700">
        <summary className="cursor-pointer text-gray-600">How the score is calculated</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Start at 100. Each finding deducts the share of rows affected (in percent) times a factor, up to a cap.</li>
          <li>Suppressed: x{w.suppressed.factor}, max {w.suppressed.cap}. Invalid format: x{w.invalid.factor}, max {w.invalid.cap}.</li>
          <li>Role addresses: x{w.role.factor}, max {w.role.cap}. Duplicates: x{w.duplicate.factor}, max {w.duplicate.cap}.</li>
          <li>Matching against the suppression list is exact, on the lowercased address.</li>
        </ul>
      </details>
    </div>
  );
}
