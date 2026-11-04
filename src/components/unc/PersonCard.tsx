import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { UncPerson } from "@/lib/unc-group.data";

export function PersonAvatar({ color, size = 96 }: { color: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full border-[3px] border-ink"
      style={{ background: color, width: size, height: size }}
    >
      <svg viewBox="0 0 48 48" width={size * 0.66} height={size * 0.66}>
        <circle cx="24" cy="18" r="8" fill="none" stroke="#000" strokeWidth="3" />
        <path
          d="M9 42c2-9 8-13 15-13s13 4 15 13"
          fill="none"
          stroke="#000"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function PersonCard({
  person,
  number,
  total,
  className = "",
}: {
  person: UncPerson;
  number: number;
  total: number;
  className?: string;
}) {
  const rows: [string, string][] = [
    ["Country", person.country],
    ["Visa Path", person.visaPath],
    ["Background", person.background],
  ];
  return (
    <Card
      className={`ceremony-card flex flex-col gap-5 border-0 p-6 text-card-foreground ${className}`}
    >
      <div className="flex items-center gap-4">
        <PersonAvatar color={person.color} />
        <div className="flex min-w-0 flex-col items-start gap-1">
          <span className="font-mono text-[12px] tracking-[0.08em] text-secondary uppercase">
            Connection {number} of {total}
          </span>
          <h2 className="text-[44px] leading-[48px] [overflow-wrap:anywhere]">{person.name}</h2>
          <Badge variant="secondary">{person.world}</Badge>
        </div>
      </div>
      <dl className="m-0 border-b border-ink/20">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 border-t border-ink/20 py-3">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="m-0 text-right font-bold">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="m-0">
        <span className="font-mono text-[12px] tracking-[0.08em] text-secondary uppercase">
          Say hello:{" "}
        </span>
        {person.starter}
      </p>
    </Card>
  );
}
