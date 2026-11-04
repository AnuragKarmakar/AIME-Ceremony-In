import type { UncPerson } from "@/lib/unc-group.data";

const QUESTION_MARKS = ["qm-violet", "qm-lemon", "qm-tangerine", "qm-violet"];

/** Four segments, one per person still to meet. */
export function UncProgress({ revealed, total }: { revealed: number; total: number }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 font-mono text-[13px] tracking-[0.08em] uppercase">
        <span className="text-cream/70">Your UNC5</span>
        <span className="text-cream">
          {revealed} of {total} · {Math.round((revealed / total) * 100)}% revealed
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Connections revealed"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={revealed}
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: total }, (_, k) => (
          <span
            key={k}
            className={`block h-3 rounded-full border-2 border-cream transition-colors duration-300 ${
              k < revealed ? "bg-gold" : "bg-transparent"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/** One round slot per person: a question mark until they are revealed. */
export function UncFaces({ revealed, total }: { revealed: UncPerson[]; total: number }) {
  return (
    <ul className="m-0 flex list-none justify-center gap-3 p-0" aria-hidden="true">
      {Array.from({ length: total }, (_, k) => {
        const p = revealed[k];
        return (
          <li
            key={k}
            className={`flex h-14 w-14 items-center justify-center rounded-full border-2 ${
              p
                ? "border-ink font-display text-[22px] text-ink"
                : "border-dashed border-cream/60 bg-ink/30"
            }`}
            style={p ? { background: p.color } : undefined}
          >
            {p ? (
              p.name.charAt(0)
            ) : (
              <img
                src={`/design/unc/${QUESTION_MARKS[k % QUESTION_MARKS.length]}.png`}
                alt=""
                className="h-[80%] w-[80%]"
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
