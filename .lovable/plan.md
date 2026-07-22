The `CeremonyIn` component in `src/routes/index.tsx` swaps between step screens (Welcome → Path → Identity → Story → Result → Journey) with an abrupt cut, and the identity form grid is unbalanced. We'll add smooth enter/exit animations and tidy the input grid using the existing Tailwind animation utilities (`tw-animate-css`) — no new dependencies.

## Plan

### 1. Smooth step transitions
Wrap the current `<section>{step === ...}</section>` content in a keyed div that re-mounts whenever `stepIdx` changes:
```tsx
<section className="mt-8 flex-1">
  <div key={stepIdx} className="animate-fade-in">
    {/* existing step conditionals */}
  </div>
</section>
```
The `key={stepIdx}` forces React to unmount the previous step and mount the new one, re-triggering the CSS animation each time. This also applies to Back navigation.

### 2. Animate the progress indicator bar fill
Ensure the progress bar segments animate to their filled state. The existing `transition-all` class on the bar already handles this; verify it remains smooth after the change.

### 3. Smooth NavBar label changes
Apply `transition-all duration-300` on the sticky NavBar so label changes ("Continue" → "Complete Ceremony" → "See River Run") feel smooth.

### 4. Tidy the identity form grid
The identity form currently uses `grid gap-4 sm:grid-cols-2` but `Country` spans two columns while `City` does not, leaving an empty cell. Change the grid so all six fields are equal-width halves on desktop:
- Remove `className="sm:col-span-2"` from the `Country` `Field`.
- Result: First name / Last name, Email / Mother tongue, City / Country — three clean rows.

### 5. Respect motion preferences
Rely on the existing `tw-animate-css` utility, which honors `prefers-reduced-motion` by default. No custom media queries needed.

### 6. Verify
- Click through Welcome → Path → Identity → Story → Result → Journey and confirm each screen fades in cleanly with no layout jump, and Back navigation animates in the same way.
- Confirm the identity form displays as a balanced 2-column grid on desktop and a single column on mobile.

Scope is purely visual/presentational — no changes to form state, validation, or evaluation logic.