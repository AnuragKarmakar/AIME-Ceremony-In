// The brain is the wheel: the whole image rotates under a fixed pointer.
const RIM_LIGHTS = Array.from({ length: 16 }, (_, k) => {
  const r = (k * 22.5 * Math.PI) / 180;
  return {
    left: `${(50 + 48 * Math.sin(r) - 1.2).toFixed(2)}%`,
    top: `${(50 - 48 * Math.cos(r) - 1.2).toFixed(2)}%`,
    odd: k % 2 === 1,
  };
});

export function BrainWheel({
  rotation,
  animate,
  landed,
  disabled,
  label,
  onSpin,
}: {
  rotation: number;
  animate: boolean;
  landed: boolean;
  disabled: boolean;
  label: string;
  onSpin: () => void;
}) {
  return (
    <div className="relative aspect-square w-[min(500px,100%)]">
      <div aria-hidden="true">
        {RIM_LIGHTS.map((d, i) => (
          <span
            key={i}
            className={`absolute h-[2.4%] w-[2.4%] rounded-full border-2 border-ink transition-colors duration-300 ${
              landed ? "bg-gold" : d.odd ? "bg-background" : "bg-cream"
            }`}
            style={{ left: d.left, top: d.top }}
          />
        ))}
        <div
          className={`absolute top-[5%] left-[5%] h-[90%] w-[90%] rounded-full border-[3px] border-cream bg-background transition-shadow duration-300 ${
            landed ? "shadow-[0_0_0_8px_var(--gold)]" : ""
          }`}
        />
      </div>
      <button
        type="button"
        onClick={onSpin}
        disabled={disabled}
        aria-label={label}
        className="absolute top-[6%] left-[6%] h-[88%] w-[88%] cursor-pointer touch-manipulation rounded-full focus-visible:ring-4 focus-visible:ring-gold focus-visible:ring-offset-4 focus-visible:ring-offset-background focus-visible:outline-none disabled:cursor-default"
      >
        <img
          src="/design/unc/brain.webp"
          alt=""
          draggable={false}
          className="block h-full w-full rounded-full select-none"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: animate ? "transform 4.2s cubic-bezier(0.15, 0.85, 0.2, 1)" : "none",
          }}
        />
      </button>
      <span
        aria-hidden="true"
        className={`absolute top-0 left-1/2 h-12 w-11 origin-top -translate-x-1/2 transition-transform duration-300 ${
          landed ? "scale-[1.18]" : ""
        }`}
      >
        <svg viewBox="0 0 44 48" width="44" height="48">
          <path
            d="M4 4 L40 4 L22 44 Z"
            fill="var(--gold)"
            stroke="#000"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </div>
  );
}
