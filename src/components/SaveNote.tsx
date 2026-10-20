import { BookmarkCheck } from "lucide-react";
import { useStorageAvailable } from "@/hooks/use-storage-available";

/**
 * The one-line reassurance that applicants can leave and return later. Shown
 * where leaving is most likely (the Welcome screen and the long quiz), so the
 * wording lives here once. Text colour comes from the caller, since it sits on
 * both the cream cards and the coloured step backgrounds.
 */
export function SaveNote({ className = "" }: { className?: string }) {
  const canSave = useStorageAvailable();
  return (
    <p className={`flex items-start gap-2 text-[13px] leading-relaxed ${className}`}>
      <BookmarkCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        {canSave
          ? "Your answers save on this device as you go. Leave any time and come back to pick up where you left off."
          : "This browser can't keep your answers between visits, so please finish in one sitting."}
      </span>
    </p>
  );
}
