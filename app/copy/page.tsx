import { CopyForm } from "@/components/CopyForm";
import { WEIGHTS, THRESHOLDS as T } from "@/lib/checks";

export default function CopyPage() {
  const w = WEIGHTS.copy;
  return (
    <div>
      <h1 className="text-xl font-semibold">Copy check</h1>
      <p className="mb-4 mt-1 text-sm text-gray-700">Paste the subject and body. Every deduction is listed with its reason.</p>
      <CopyForm />
      <details className="mt-8 text-sm text-gray-700">
        <summary className="cursor-pointer text-gray-600">How the score is calculated</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Start at 100. Subtract the points of each finding.</li>
          <li>Spam-trigger phrases: {w.spamPhrases.perPhrase} each, max {w.spamPhrases.cap}; fail from {w.spamPhrases.failAt} phrases.</li>
          <li>Subject: empty -{w.subjectEmpty}; over {T.subjectMax} characters -{w.subjectLong}.</li>
          <li>Links (3 or more): over {T.linksPer100Warn} per 100 words -{w.linkRatioWarn}; over {T.linksPer100Fail} -{w.linkRatioFail}.</li>
          <li>All-caps words (5 or more words): over {T.capsWarn * 100}% -{w.capsWarn}; over {T.capsFail * 100}% -{w.capsFail}.</li>
          <li>No unsubscribe mention: -{w.noUnsubscribe}.</li>
          <li>Images with under 10 words of text: -{w.imageOnly}.</li>
          <li>80 and up: ready. 60 to 79: fix before sending. Under 60: do not send.</li>
        </ul>
      </details>
    </div>
  );
}
