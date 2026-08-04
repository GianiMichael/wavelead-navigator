# Area field: type-ahead suggestions (no API calls)

Turn the Lead Engine "Area" box into a free-text input with a live suggestion dropdown. Suggestions come from a built-in dataset bundled with the app — no Google Places calls, no per-keystroke cost, and it works in demo mode identically.

## Behavior

- Start typing and a dropdown appears under the field with up to 8 matches, filtered as you type.
- Matches cover: all 50 state names and codes, plus major metros in the deregulated/partial markets we target (e.g. "Houston, TX", "Dallas, TX", "Chicago, IL", "Philadelphia, PA", "Boston, MA", "New York, NY").
- Ranking: prefix matches first, then substring matches; deregulated-market entries rank above others since those are the ones that convert.
- Click a suggestion, or Up/Down + Enter, to fill the field. Escape or clicking outside closes it.
- Anything typed is accepted as-is — Search stays enabled without picking from the list, so "78701" or "Katy, TX metro" still works.

## Why this instead of Google Places

Places Autocomplete bills per request, and a search box fires one on every typing pause. The area input only needs to help users spell a city/state we already care about, and that set is small and stable — so a local list gives the same UX at zero cost and zero latency. If coverage ever feels thin, adding more metros is a one-line edit to the data file.

## Technical notes

- New `src/data/area-suggestions.ts`: exports `AREA_SUGGESTIONS: { label: string; state: string; deregulated: boolean }[]`, built from the existing `deregulated-markets` list plus a hand-curated metro list (~120 entries, a few KB).
- New `src/components/AreaCombobox.tsx`: controlled input + absolutely-positioned suggestion list styled to match the existing glass panels; `useMemo` filtering, keyboard navigation, outside-click dismissal. No network, no server function.
- `src/pages/LeadEnginePage.tsx` swaps the Area `<Input>` for `<AreaCombobox value={location} onChange={setLocation} />`; the "Deregulated: …" helper text stays below it.
- Search behavior, deep links (`/app?location=…`), and the Google Places prospect search itself are untouched.
