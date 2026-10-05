import { useEffect, useState } from "react";

// Mirrors the `prefers-reduced-motion` check already inlined in
// routes/index.tsx, factored out so the new ambient/splash/toast components
// can skip their animations without each re-implementing the matchMedia call.
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mql.matches);
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
