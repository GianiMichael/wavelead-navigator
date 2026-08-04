# Tone Down Gradient Usage

## Goal
Keep the dark command-center aesthetic and the existing color scheme, but make the purple-to-magenta-to-peach gradients feel less loud on buttons, stats, and highlighted words.

## What will change

### 1. Gradient definition
- Replace the current 3-stop high-chroma `--cc-grad` with a calmer 2-stop gradient.
- Lower chroma on both stops so it reads as a soft accent rather than a neon sign.
- Keep the hue direction (cool purple toward warm peach) so the brand identity stays recognizable.

### 2. Buttons
- Primary CTA buttons move from `grad-fill` to a solid `bg-primary` with a subtle hover state.
- The "Refresh status" button and filter chips in Pipeline use the same solid primary treatment when active.
- Inline gradient styles in `MarketIntelPage.tsx` for the "Start Prospecting" link are replaced with the same solid primary class.

### 3. Gradient text
- `grad-text` is reserved for one headline accent per page instead of every stat block.
- Remove `grad-text` from `StatBlock` accent numbers; use `text-foreground` or `text-primary` instead.
- Keep `grad-text` on the hero phrases "deregulated markets" / "open markets" / "best opportunities" because those are the signature brand moments.

### 4. Charts and bars
- Rate bars in the state rates panel switch from the inline gradient to a solid `bg-primary`.
- Industry distribution bars in Pipeline switch from `grad-fill` to `bg-primary`.
- Map metric legends and any other small bar indicators use solid colors.

### 5. Files to edit
- `src/styles.css` — redefine `--cc-grad`, add a subtle solid primary hover utility if needed.
- `src/components/StatBlock.tsx` — remove `grad-text` from accent state.
- `src/pages/LeadEnginePage.tsx` — replace `grad-fill` button with solid primary.
- `src/pages/PipelinePage.tsx` — replace `grad-fill` on sync button, active chips, and distribution bars.
- `src/pages/MarketIntelPage.tsx` — replace inline gradients on ProspectLink and rate bars; keep only hero word accents.
- `src/routes/index.tsx` — replace `grad-fill` buttons with solid primary.

## Outcome
The app keeps its dark glassmorphic look, but gradients become a quiet accent instead of the dominant visual effect. Buttons and stats feel more polished and less visually noisy.
