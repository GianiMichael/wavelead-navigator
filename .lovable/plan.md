# Area field: type-ahead suggestions

Turn the Lead Engine "Area" box into a free-text input with a live suggestion dropdown powered by Google Places autocomplete. Typing still works exactly as today — the dropdown is optional help, never a requirement.

## Behavior

- Type two or more characters, wait ~300ms, and a dropdown appears under the field with up to 5 matching US cities/regions (e.g. "Dallas, TX, USA").
- Click a suggestion, or use Up/Down + Enter, to fill the field. Escape or clicking elsewhere closes the dropdown.
- Anything typed is accepted as-is; Search stays enabled without picking a suggestion.
- Suggestions are cosmetic — the actual prospect search keeps using the text in the box, unchanged.
- If the suggestion request fails or the key is unavailable, the dropdown quietly stays hidden and the field behaves like a plain input.

## Demo mode

In demo mode no external call is made; suggestions come from a small built-in list of deregulated-market metros so the demo stays API-free.

## Technical notes

- New server helper `src/lib/places.server.ts` → `autocompletePlaces(input)` calling `POST https://places.googleapis.com/v1/places:autocomplete` with the existing `GOOGLE_API_KEY`, `includedPrimaryTypes: ["locality","administrative_area_level_1"]`, `includedRegionCodes: ["us"]`, returning `[{ text }]`. Failures return an empty array rather than throwing.
- New `createServerFn({ method: "POST" })` wrapper `getAreaSuggestions` in `src/lib/lead-engine.functions.ts`, input validated with Zod (`input: string, 2–120 chars`).
- New component `src/components/AreaCombobox.tsx`: controlled input + absolutely-positioned suggestion list styled to match the existing glass panels, debounce via `useEffect` timer, in-memory cache keyed by query string to limit calls, keyboard nav and outside-click dismissal.
- `src/pages/LeadEnginePage.tsx` swaps the Area `<Input>` for `<AreaCombobox value={location} onChange={setLocation} demo={demo} />`; the deregulated-states helper text stays below it.

## Cost

Places Autocomplete is billed per request; debounce + minimum length + per-query caching keep it to roughly one call per pause in typing.
