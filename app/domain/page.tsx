import { DomainForm } from "@/components/DomainForm";
import { WEIGHTS } from "@/lib/checks";

export default function DomainPage() {
  const w = WEIGHTS.domain;
  return (
    <div>
      <h1 className="text-xl font-semibold">Domain check</h1>
      <p className="mb-4 mt-1 text-sm text-gray-700">Live SPF, DMARC and MX lookups over DNS-over-HTTPS (Cloudflare). The records found are shown as published.</p>
      <DomainForm />
      <details className="mt-8 text-sm text-gray-700">
        <summary className="cursor-pointer text-gray-600">How the score is calculated</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Start at 100. Subtract the points of each finding.</li>
          <li>SPF: missing -{w.spfMissing}; more than one record -{w.spfMultiple}; ends in +all -{w.spfOpen}; ?all -{w.spfNeutral}; no all -{w.spfNoAll}; over 10 lookup terms -{w.spfLookups}.</li>
          <li>DMARC: missing -{w.dmarcMissing}; p=none -{w.dmarcNone}; no valid p= -{w.dmarcInvalid}.</li>
          <li>MX: missing or null MX -{w.mxMissing}.</li>
          <li>A lookup that fails or times out (8s) is marked unknown and deducts nothing.</li>
        </ul>
      </details>
    </div>
  );
}
