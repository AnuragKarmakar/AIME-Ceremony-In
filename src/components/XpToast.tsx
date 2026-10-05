// Small "+100 XP" pill shown briefly after each step advance. The parent
// owns the show/hide timer (mirrors how `evaluating`/`evalError` are owned
// by CeremonyIn already) so this stays a pure presentational component.
export function XpToast({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div
      role="status"
      className="cer-toast fixed top-9 right-5 z-50 flex items-center gap-1.5 rounded-full bg-primary px-[18px] py-2.5 text-sm font-bold text-primary-foreground shadow-[0_14px_34px_-12px_oklch(0.1_0.1_300_/_0.6)]"
    >
      <img src="/design/badge-star.png" alt="" className="h-4 w-4 object-contain" />
      +100 XP
    </div>
  );
}
