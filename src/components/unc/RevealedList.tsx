import type { UncPerson } from "@/lib/unc-group.data";

export function RevealedList({ people }: { people: UncPerson[] }) {
  if (people.length === 0) return null;
  return (
    <section className="flex flex-col gap-3" aria-labelledby="unc-revealed">
      <h3 id="unc-revealed" className="m-0 font-mono text-[13px] tracking-[0.08em] text-cream/70">
        Revealed so far
      </h3>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {people.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-3 rounded-lg border-2 border-cream bg-ink/30 py-2 pr-3 pl-2 text-[14px] leading-5 text-cream"
          >
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink font-bold text-ink"
              style={{ background: p.color }}
            >
              {p.name.charAt(0)}
            </span>
            <span>
              <strong>{p.name}</strong> · {p.country}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
