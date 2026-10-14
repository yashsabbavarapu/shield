import Link from "next/link";

export default function Home() {
  return (
    <div>
      <h1 className="text-xl font-semibold">Shield</h1>
      <p className="mt-2 text-sm text-gray-700">
        Check a send before it goes out: <Link className="underline" href="/copy">copy</Link>, <Link className="underline" href="/domain">domain</Link> and{" "}
        <Link className="underline" href="/list">list</Link>, against the <Link className="underline" href="/suppressions">suppression list</Link>.
      </p>
    </div>
  );
}
