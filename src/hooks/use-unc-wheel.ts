import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UNC_GROUP, UNC_LANDING_ANGLES, UNC_ME_ID, type UncPerson } from "@/lib/unc-group.data";

const SPIN_MS = 4300; // matches the 4.2s ease on the brain plus a beat
const CARD_DELAY_MS = 700; // pause on the landed brain before the card appears
const MEET_MS = 4000; // how long the name stays in the headline

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Rotation that ends with lobe `lobe` under the pointer, after at least four full turns. */
function targetRotation(current: number, lobe: number): number {
  const target = (360 - UNC_LANDING_ANGLES[lobe]) % 360;
  let next = current - (((current % 360) + 360) % 360) + 360 * 5 + target;
  while (next - current < 1440) next += 360;
  return next;
}

/**
 * State for the reveal. Who the group is and the order they appear in are
 * fixed before any spin; a spin only animates towards the next person and
 * never decides who it is.
 */
export function useUncWheel(reducedMotion: boolean) {
  const others = useMemo(() => UNC_GROUP.filter((p) => p.id !== UNC_ME_ID), []);
  const total = others.length;

  // Shuffled once, on the first reveal (not at render, so SSR and hydration agree).
  const orderRef = useRef<UncPerson[] | null>(null);
  const timers = useRef<number[]>([]);
  const busy = useRef(false);

  const [revealed, setRevealed] = useState<UncPerson[]>([]);
  const [current, setCurrent] = useState<UncPerson | null>(null);
  const [rotation, setRotation] = useState(0);
  const [animate, setAnimate] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [meet, setMeet] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const nextPerson = useCallback((): { person: UncPerson; position: number } | null => {
    orderRef.current ??= shuffle(others);
    const position = revealed.length;
    const person = orderRef.current[position];
    return person ? { person, position } : null;
  }, [others, revealed.length]);

  const announce = useCallback(
    (p: UncPerson, position: number) =>
      setAnnouncement(`Connection ${position + 1} of ${total}: ${p.name}, from ${p.country}.`),
    [total],
  );

  /** Everything that happens once the brain has stopped. */
  const land = useCallback(
    (p: UncPerson, position: number, instant: boolean) => {
      busy.current = false;
      setSpinning(false);
      setAnimate(false);
      setLanded(true);
      setMeet(true);
      setRevealed((r) => (r.some((x) => x.id === p.id) ? r : [...r, p]));
      const showIt = () => {
        setShowCard(true);
        announce(p, position);
        later(() => setMeet(false), MEET_MS);
      };
      if (instant) showIt();
      else later(showIt, CARD_DELAY_MS);
    },
    [announce, later],
  );

  const begin = useCallback(
    (instant: boolean) => {
      if (busy.current) return;
      const next = nextPerson();
      if (!next) return;
      const { person, position } = next;
      busy.current = true;
      clearTimers();
      setCurrent(person);
      setShowCard(false);
      setMeet(false);
      setLanded(false);
      setRotation((r) => targetRotation(r, others.indexOf(person)));
      if (instant) {
        setAnimate(false);
        land(person, position, true);
        return;
      }
      setAnimate(true);
      setSpinning(true);
      setAnnouncement("Spinning.");
      later(() => land(person, position, false), SPIN_MS);
    },
    [clearTimers, land, later, nextPerson, others],
  );

  /** Spin, or reveal at once when reduced motion is on. */
  const spin = useCallback(() => begin(reducedMotion), [begin, reducedMotion]);
  /** Reveal the next person without any animation. */
  const revealNow = useCallback(() => begin(true), [begin]);
  /** Cut a spin short: the brain jumps to where it was heading and the reveal completes. */
  const skip = useCallback(() => {
    if (!spinning || !current) return;
    clearTimers();
    land(current, revealed.length, true);
  }, [clearTimers, current, land, revealed.length, spinning]);

  return {
    total,
    revealed,
    current,
    rotation,
    animate: animate && !reducedMotion,
    spinning,
    landed,
    showCard,
    meet,
    announcement,
    done: revealed.length >= total,
    spin,
    revealNow,
    skip,
  };
}
