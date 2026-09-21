# Liquid / Optical Glass Design System — Deep Spec

## Purpose

This document defines a reusable visual system for creating interfaces with a modern, iOS-inspired **Liquid / Optical Glass** aesthetic.

The target is **not** conventional 2020-era glassmorphism made from white translucent rectangles and heavy blur. The goal is a more physical, optical material:

- clear enough to preserve the environment behind it
- soft enough to remain legible
- dimensional enough to feel like real glass
- responsive enough to feel integrated with the interface
- restrained enough to remain premium rather than decorative

The result should feel like polished optical glass suspended above real content.

**Keywords:** optical depth, refraction, reflection, adaptive translucency, environmental tint, specular highlight, continuous curvature, fluid geometry, material response.

---

# 1. Visual Philosophy

Glass is a **material**, not an effect.

Do not begin with:

> “Add a white transparent card and blur the background.”

Begin with:

> “Place a thin optical material above real content and define how light, color, depth, and motion behave through it.”

A successful glass surface should simultaneously communicate:

1. **Transparency** — some of the environment remains visible.
2. **Diffusion** — distracting detail is softened.
3. **Refraction** — content appears subtly displaced or optically altered.
4. **Reflection** — light catches the surface and edges.
5. **Thickness** — the surface has a believable physical boundary.
6. **Adaptation** — the material visually responds to what is behind it.
7. **Continuity** — controls feel like parts of one coherent material system.

The visual goal is:

> luminous, dimensional, fluid, quiet, optical, restrained.

Avoid:

> milky acrylic, smoky plastic, frosted SaaS cards, neon cyberpunk glass, candy gradients, excessive blur, glowing borders, decorative blobs.

---

# 2. Core Depth Model

Use a four-layer model.

## Layer 1 — Environment

The visual content that exists behind the glass.

This may be:

- photography
- illustrations
- maps
- album art
- application content
- video stills
- gradients
- softly colored page backgrounds
- charts or data visualizations

The environment should contain enough luminance and hue variation for the glass to interact with it.

Do not add meaningless gradient blobs solely to make the glass visible.

---

## Layer 2 — Optical Refraction

This is the layer that separates modern Liquid / Optical Glass from generic glassmorphism.

Background content seen through the material may become:

- slightly displaced
- slightly magnified
- softly diffused
- subtly curved near boundaries
- locally compressed or stretched
- gently tinted

Refraction must remain subtle.

The viewer should perceive:

> “There is a transparent material here.”

They should not think:

> “A distortion filter was applied.”

The strongest optical change should occur near curved edges and transitions. The center should remain comparatively stable.

Never apply strong, uniform distortion across the entire glass surface.

---

## Layer 3 — Glass Body

The glass body provides:

- translucency
- local blur
- density
- tint
- contrast management

Do **not** define glass mainly through a fixed white opacity.

The material should inherit some of the color and luminosity of the environment behind it.

Large uniform fills such as:

```css
background: rgba(255, 255, 255, 0.5);
```

should not be the default solution.

Use a layered material instead.

Example baseline:

```css
.glass {
  background:
    linear-gradient(
      145deg,
      rgba(255,255,255,0.22),
      rgba(255,255,255,0.08)
    );

  backdrop-filter:
    blur(18px)
    saturate(1.12);

  -webkit-backdrop-filter:
    blur(18px)
    saturate(1.12);
}
```

This is a starting point, not a fixed recipe.

---

## Layer 4 — Surface Lighting

The outer surface creates the sensation of thickness.

Use:

- directional edge highlights
- subtle specular reflections
- soft contact shadows
- internal luminance variation
- restrained rim brightness

A glass surface should not be outlined uniformly in white.

Avoid:

```css
border: 1px solid rgba(255,255,255,0.8);
```

as the only definition of its boundary.

Instead, use a softer edge plus directional highlights.

Example:

```css
.glass {
  border: 1px solid rgba(255,255,255,0.22);

  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.45),
    inset 1px 0 0 rgba(255,255,255,0.12),
    0 10px 30px rgba(20,30,25,0.08),
    0 2px 8px rgba(20,30,25,0.05);
}
```

The highlight should imply a light source, not a sticker-like outline.

---

# 3. Optical Refraction System

Blur alone is not enough.

Where technically feasible, introduce subtle optical displacement.

## Refraction principles

- Keep the central region visually stable.
- Increase optical distortion slightly near curved edges.
- Never distort text placed inside the glass.
- Distort only the background content seen through the material.
- Refraction should be more noticeable over photography and complex imagery.
- Over flat backgrounds, reduce the effect.

Possible implementations:

- SVG displacement maps
- WebGL shaders
- CSS masking combined with scaled background layers
- duplicated background layers with slight transforms
- canvas-based optical distortion
- platform-native glass materials when available

If true refraction is not technically possible, simulate it with:

- slight scale difference
- local contrast shift
- edge magnification
- directional highlight
- subtle environmental tint

---

# 4. Adaptive Translucency

Glass strength should respond to its environment.

A surface placed over a visually busy image requires more diffusion than the same surface over a quiet gradient.

Think in terms of:

```text
environment complexity
→ required diffusion
→ required tint
→ required contrast
```

Recommended logic:

### Quiet background
Use:
- lower opacity
- lower blur
- more transparency

### Medium-detail background
Use:
- moderate blur
- subtle tint
- stronger edge definition

### High-detail background
Use:
- stronger diffusion
- slightly denser material
- stronger text contrast
- reduced chroma behind text

Do not use one opacity value everywhere.

---

# 5. Material Tiers

Use three optical strength tiers.

## Clear Glass

Use for:
- floating controls
- small pills
- toolbar elements
- secondary actions

```css
.glass-clear {
  background: linear-gradient(
    145deg,
    rgba(255,255,255,0.16),
    rgba(255,255,255,0.06)
  );

  backdrop-filter: blur(12px) saturate(1.08);
  -webkit-backdrop-filter: blur(12px) saturate(1.08);

  border: 1px solid rgba(255,255,255,0.18);

  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.34),
    0 6px 20px rgba(20,30,25,0.06);
}
```

---

## Balanced Glass

Use for:
- cards
- panels
- navigation
- primary information surfaces

```css
.glass-balanced {
  background: linear-gradient(
    145deg,
    rgba(255,255,255,0.22),
    rgba(255,255,255,0.09)
  );

  backdrop-filter: blur(18px) saturate(1.12);
  -webkit-backdrop-filter: blur(18px) saturate(1.12);

  border: 1px solid rgba(255,255,255,0.22);

  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.45),
    inset 1px 0 0 rgba(255,255,255,0.10),
    0 10px 28px rgba(20,30,25,0.07);
}
```

---

## Dense Glass

Use for:
- hero content
- text-heavy overlays
- accessibility-critical information
- busy photographic backgrounds

```css
.glass-dense {
  background: linear-gradient(
    145deg,
    rgba(255,255,255,0.30),
    rgba(255,255,255,0.14)
  );

  backdrop-filter: blur(24px) saturate(1.06);
  -webkit-backdrop-filter: blur(24px) saturate(1.06);

  border: 1px solid rgba(255,255,255,0.28);

  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.52),
    0 14px 36px rgba(20,30,25,0.08);
}
```

Do not stack Dense Glass inside Dense Glass.

---

# 6. Glass Thickness

Glass should appear thin but physical.

Thickness comes from several small signals:

- slightly brighter upper or light-facing edge
- slightly darker opposite edge
- environmental color pickup
- soft contact shadow
- subtle internal gradient
- slightly different optical behavior near the boundary

Do not make thickness exaggerated.

The viewer should feel it, not notice it.

---

# 7. Specular Highlight

The highlight is not a decoration.

It represents reflected light.

## Rules

- Keep it directional.
- Use one dominant light source.
- Avoid glowing all four edges.
- Avoid pure-white neon outlines.
- Keep the highlight narrow and low-opacity.
- Allow its position to change subtly on interaction when appropriate.

Example:

```css
.glass::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;

  background:
    linear-gradient(
      135deg,
      rgba(255,255,255,0.34) 0%,
      rgba(255,255,255,0.10) 22%,
      transparent 42%
    );

  mix-blend-mode: screen;
  opacity: 0.55;
}
```

The exact values must adapt to the background.

---

# 8. Environment-Aware Tint

The material should not always look white.

It may subtly inherit nearby color.

Examples:

- warm peach background → faint warm tint
- blue photograph → faint cool tint
- green landscape → faint green-gray tint

Tint should never become a new accent color.

The environment remains the source.

Example:

```css
.glass-warm {
  background:
    linear-gradient(
      145deg,
      rgba(255,245,238,0.22),
      rgba(255,255,255,0.08)
    );
}

.glass-cool {
  background:
    linear-gradient(
      145deg,
      rgba(240,248,255,0.22),
      rgba(255,255,255,0.07)
    );
}
```

---

# 9. Background / Environment System

The background is not restricted to gradients.

Recommended sources:

- photography with soft depth
- floral or natural imagery
- wallpaper-like abstract art
- subtle multitone gradients
- maps
- artwork
- album covers
- blurred application content

The best backgrounds contain:

- 2–4 dominant hues
- soft luminance variation
- gradual transitions
- identifiable but not hyper-detailed forms

Avoid:

- flat white backgrounds
- flat black backgrounds
- excessively saturated gradients
- meaningless animated gradient orbs
- backgrounds that exist only to advertise the glass effect

Example soft field:

```css
body {
  background:
    radial-gradient(
      ellipse 70% 60% at 80% 10%,
      rgba(180,210,185,0.42) 0%,
      transparent 62%
    ),
    radial-gradient(
      ellipse 50% 70% at 15% 85%,
      rgba(225,188,160,0.32) 0%,
      transparent 58%
    ),
    linear-gradient(
      160deg,
      #F5F0E8 0%,
      #E8EDE3 46%,
      #DCE8DC 100%
    );
}
```

---

# 10. Geometry

Modern glass interfaces should not feel like a collection of identical rounded rectangles.

Use:

- continuous corners
- concentric curves
- capsules
- squircles
- organically rounded panels
- geometry that relates to surrounding hardware or layout

## Rules

- Do not use the same radius everywhere.
- Nested surfaces should visually inherit their parent curvature.
- Large containers should use broader, smoother curves.
- Small controls may use capsule geometry.
- Avoid sharp 0px corners.
- Avoid excessive pill shapes when they do not serve a control purpose.

Suggested range:

```text
Large panels:      24–34px
Medium cards:      18–26px
Small controls:    12–18px
Pills:             999px
```

But visual continuity matters more than numeric uniformity.

---

# 11. Fluid Geometry

Where interaction changes the amount of content, prefer morphing over abrupt resizing.

Examples:

- compact control expands into a menu
- segmented control transitions into a larger sheet
- glass chip becomes an action panel
- toolbar expands while retaining its material identity

The glass surface should feel like one continuous object changing form.

Avoid:

- sudden hard cuts
- unrelated popups appearing from nowhere
- scale-heavy animation
- cartoon-like bouncing

---

# 12. Color System

The system uses two classes of color.

## Environmental palette

These colors belong to the page, image, or wallpaper.

Examples:

```text
Warm cream:       #F5F0E8
Soft sage:        #E8EDE3
Muted peach:      #F0C7AF
Mist blue:        #DDE8F0
Lavender haze:    #E4DFF0
```

Do not force these exact values.

The environment defines the palette.

---

## Interface accent

Use one vivid accent at a time.

Example:

```text
Accent violet:    #6B4EFF
Accent dark:      #5038E0
Accent tint:      rgba(107,78,255,0.10)
```

Alternative accents are acceptable if the application context requires them.

Rules:

- one dominant accent
- accent is for interaction and status
- environmental color should remain separate from interaction color
- do not use multiple saturated accents structurally

---

# 13. Text Color

Avoid pure black over glass.

Use warm or cool near-black depending on the environment.

Warm:

```text
Primary:   #1A2E1F
Secondary: #3D4F3F
Muted:     #738176
```

Cool:

```text
Primary:   #1F2430
Secondary: #46505E
Muted:     #75808E
```

Text must remain readable even when the background changes.

---

# 14. Typography

Use a quiet, modern typographic hierarchy.

For expressive editorial interfaces:

```text
Display:
- New York / system serif where available
- DM Serif Display
- Playfair Display
- Cormorant Garamond

Body / UI:
- SF Pro / system UI
- Inter
- DM Sans
- Plus Jakarta Sans
```

For an iOS-inspired interface, system typography is often preferable.

Example:

```css
body {
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    "SF Pro Text",
    "Segoe UI",
    sans-serif;
}
```

Rules:

- prioritize legibility over personality
- do not use heavy 900 weights for body text
- use tight but not cramped heading tracking
- use muted secondary text carefully over glass
- increase density of the glass before lowering text contrast

---

# 15. Content Density

Glass surfaces work best with restrained content.

Recommended hierarchy:

1. small contextual label
2. primary title or number
3. short supporting line
4. optional visualization or action

Avoid filling every glass card with:

- long paragraphs
- many icons
- many badges
- excessive metadata
- decorative labels

If content becomes dense, increase material density or switch to a more opaque panel.

---

# 16. Navigation

Navigation should feel suspended above content.

Recommended approaches:

- floating glass bar
- capsule toolbar
- bottom glass navigation
- compact contextual header
- translucent sidebar

Example:

```css
.nav-glass {
  position: sticky;
  top: 16px;
  z-index: 100;

  width: min(860px, calc(100% - 32px));
  margin-inline: auto;

  display: flex;
  align-items: center;
  justify-content: space-between;

  padding: 10px 14px;
  border-radius: 999px;

  background:
    linear-gradient(
      145deg,
      rgba(255,255,255,0.24),
      rgba(255,255,255,0.08)
    );

  backdrop-filter: blur(20px) saturate(1.10);
  -webkit-backdrop-filter: blur(20px) saturate(1.10);

  border: 1px solid rgba(255,255,255,0.20);

  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.42),
    0 10px 30px rgba(20,30,25,0.07);
}
```

Avoid a full-width opaque navigation bar unless the product context requires one.

---

# 17. Buttons and Controls

Not every button needs to be solid.

Use three levels.

## Primary Action

The strongest action may be:

- solid accent
- dense tinted glass
- high-contrast glass

Example:

```css
.btn-primary {
  background: #6B4EFF;
  color: white;

  padding: 12px 20px;
  border-radius: 14px;

  border: 0;

  box-shadow:
    0 8px 22px rgba(107,78,255,0.24),
    inset 0 1px 0 rgba(255,255,255,0.20);
}
```

---

## Glass Action

```css
.btn-glass {
  background:
    linear-gradient(
      145deg,
      rgba(255,255,255,0.20),
      rgba(255,255,255,0.07)
    );

  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);

  border: 1px solid rgba(255,255,255,0.20);

  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.34),
    0 6px 16px rgba(20,30,25,0.05);
}
```

---

## Tinted Glass Action

```css
.btn-tinted {
  background:
    linear-gradient(
      145deg,
      rgba(107,78,255,0.16),
      rgba(107,78,255,0.08)
    );

  color: #5B43E8;

  border: 1px solid rgba(107,78,255,0.16);
}
```

Do not require the primary action to be the only non-glass element.

Choose the treatment that best supports hierarchy.

---

# 18. Icons

Icons should feel native to the interface.

Prefer:

- simple line icons
- platform-consistent symbols
- monochrome glyphs
- subtle filled states for selection

Avoid:

- emoji as functional icons
- multicolor clip-art
- excessive icon containers
- unnecessary circular backgrounds behind every icon

---

# 19. Cards and Panels

A card should exist because it groups content, not because glass looks attractive.

Before creating a new glass panel, ask:

> Does this content need a separate depth layer?

If not, keep it on the existing surface.

Avoid “card soup”.

Recommended depth hierarchy:

```text
Page environment
→ major glass region
→ content
→ optional small glass control
```

Do not repeatedly nest large blurred surfaces.

---

# 20. Data Visualization

Charts should appear integrated into the material.

Use:

- thin lines
- translucent tracks
- restrained fills
- one vivid accent
- subtle supporting colors

Charts should not become the most visually saturated element unless they are the primary content.

Example ring:

```html
<svg width="160" height="160" viewBox="0 0 160 160">
  <circle
    cx="80"
    cy="80"
    r="65"
    fill="none"
    stroke="rgba(30,40,35,0.08)"
    stroke-width="8"
  />

  <circle
    cx="80"
    cy="80"
    r="65"
    fill="none"
    stroke="#6B4EFF"
    stroke-width="8"
    stroke-linecap="round"
    stroke-dasharray="408"
    stroke-dashoffset="98"
  />
</svg>
```

---

# 21. Motion Philosophy

Motion should communicate continuity of material.

Use four motion categories.

## 1. Content Reveal

Examples:

- data ring draws
- progress bar extends
- content fades in
- chart line reveals

Recommended timing:

```text
0.7s–1.3s
cubic-bezier(0.4, 0, 0.2, 1)
```

---

## 2. Hover / Pointer Response

Allowed:

- translateY(-1px) to -3px
- subtle shadow increase
- gentle highlight movement
- small tint change

Avoid:

- scaling whole cards
- exaggerated parallax
- bouncing
- large rotations

---

## 3. Material Response

The glass itself may react.

Examples:

- specular highlight shifts slightly
- tint changes subtly
- refraction changes slightly
- adjacent glass surfaces visually merge
- expanded controls morph from their original geometry

Movement must be subtle.

The effect should read as:

> material response

not:

> animation showcase

---

## 4. State Transition

Examples:

- toggle movement
- segmented control selection
- toolbar expansion
- sheet reveal
- tab transition

Transitions should preserve spatial continuity.

---

# 22. Reduced Motion

Always support reduced motion.

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Do not disable essential state feedback.

---

# 23. Accessibility

Glass must never reduce usability.

## Contrast

If text becomes difficult to read:

1. increase local glass density
2. increase diffusion
3. reduce background chroma
4. add subtle tint
5. increase text contrast

Do not simply add a dark text shadow.

---

## Transparency Preference

Where possible, support reduced transparency.

Example:

```css
@media (prefers-reduced-transparency: reduce) {
  .glass,
  .glass-clear,
  .glass-balanced,
  .glass-dense {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    background: rgba(245,245,245,0.96);
  }
}
```

If the platform does not support this media query, provide an equivalent accessibility setting.

---

## Touch Targets

Recommended minimum:

```text
44px × 44px
```

Do not sacrifice touch usability for visual minimalism.

---

# 24. Responsive Behavior

On smaller screens:

- reduce the number of simultaneous glass layers
- increase readability
- simplify overlapping compositions
- preserve primary content
- use larger touch targets
- avoid tiny floating controls

Glass density may need to increase slightly on small screens because background content occupies a larger percentage of the viewport.

---

# 25. Performance

Backdrop filters and real-time optical effects are expensive.

Use restraint.

Recommended strategy:

- use true refraction only on major hero surfaces or key controls
- avoid many simultaneous large blur regions
- avoid nested heavy filters
- reuse shared materials
- reduce effects during scroll if necessary
- test on mobile hardware

Performance is part of the visual quality.

A beautiful interface that stutters does not feel premium.

---

# 26. Graceful Fallback

If blur or refraction is unsupported:

1. preserve layout
2. preserve contrast
3. preserve hierarchy
4. replace glass with a softly tinted translucent or opaque surface

Example:

```css
.glass {
  background: rgba(245,245,245,0.82);
}

@supports (
  (backdrop-filter: blur(10px)) or
  (-webkit-backdrop-filter: blur(10px))
) {
  .glass {
    background:
      linear-gradient(
        145deg,
        rgba(255,255,255,0.22),
        rgba(255,255,255,0.08)
      );

    backdrop-filter: blur(18px) saturate(1.12);
    -webkit-backdrop-filter: blur(18px) saturate(1.12);
  }
}
```

---

# 27. Layout Principles

The optical material system must remain independent from any one page template.

Do not bake the following into the core style:

- finance dashboard
- pricing table
- SaaS hero
- wellness tracker
- bento grid
- subscription toggle

These are layout patterns, not material rules.

The same glass system should work for:

- landing pages
- dashboards
- media players
- mobile apps
- portfolios
- productivity tools
- maps
- settings panels
- commerce
- editorial interfaces

---

# 28. Optional Layout Pattern — Floating Hero

Recommended structure:

```text
Environment / visual background
        ↓
Floating glass hero panel
        ↓
Primary title
Supporting copy
Primary action
        ↓
Optional compact glass metrics
```

The hero panel should not obscure the background completely.

---

# 29. Optional Layout Pattern — Layered Media Card

Use when visual content is central.

Structure:

```text
Image / artwork / video
        ↓
Optical glass overlay
        ↓
Title
Metadata
Controls
```

The overlay should inherit the hue of the image underneath.

---

# 30. Optional Layout Pattern — Floating Toolbar

Structure:

```text
Main content
        ↓
compact glass capsule
        ↓
3–5 primary actions
```

Keep the toolbar visually quiet.

---

# 31. Optional Layout Pattern — Bento Grid

An asymmetric grid can be used, but it is not mandatory.

Example:

```css
.bento {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr;
  gap: 16px;
}

.bento .wide {
  grid-column: span 2;
}

.bento .tall {
  grid-row: span 2;
}
```

Use only when the content genuinely benefits from grouped visual modules.

---

# 32. Optional Layout Pattern — Pricing

Pricing cards may use glass, but avoid making every tier visually identical.

Possible hierarchy:

- secondary plan → Clear Glass
- standard plan → Balanced Glass
- featured plan → Dense Glass or solid/tinted anchor

The featured plan does not have to be a solid dark rectangle.

Choose hierarchy based on the page context.

---

# 33. Anti-Patterns

Never use the following as defaults.

## Material mistakes

- ✗ blur alone
- ✗ milky white rectangles
- ✗ uniform white borders
- ✗ glowing neon outlines
- ✗ identical opacity on every surface
- ✗ identical blur on every surface
- ✗ heavy blur nested inside heavy blur
- ✗ glass that looks like plastic
- ✗ glass with no visible environmental interaction
- ✗ excessive translucency that harms readability

---

## Layout mistakes

- ✗ a glass card around every piece of content
- ✗ dozens of floating rectangles
- ✗ decorative cards with no information hierarchy
- ✗ full-page visual noise
- ✗ background blobs added only to “show off” transparency

---

## Color mistakes

- ✗ many saturated accents
- ✗ rainbow gradients
- ✗ neon cyberpunk palette unless explicitly requested
- ✗ pure black text everywhere
- ✗ pure white text everywhere
- ✗ color used without semantic purpose

---

## Motion mistakes

- ✗ floating animated blobs
- ✗ continuous idle movement
- ✗ exaggerated parallax
- ✗ whole-card scale animation
- ✗ bouncing
- ✗ shimmer everywhere
- ✗ animation that does not communicate state or material behavior

---

## Typography mistakes

- ✗ overly decorative body fonts
- ✗ poor contrast over busy backgrounds
- ✗ excessive bold weight
- ✗ too many typefaces
- ✗ tiny muted text on transparent surfaces

---

# 34. Modern Optical Glass Checklist

Before finalizing a design, verify:

- [ ] Does the material interact with the environment behind it?
- [ ] Is there more than blur?
- [ ] Is refraction present or plausibly simulated?
- [ ] Does the material inherit environmental hue?
- [ ] Are highlights directional rather than uniform?
- [ ] Does the surface feel physically thin but dimensional?
- [ ] Are nested glass layers limited?
- [ ] Is text still readable over complex backgrounds?
- [ ] Are the curves visually continuous?
- [ ] Does motion preserve material continuity?
- [ ] Are there too many glass cards?
- [ ] Is there only one main interaction accent?
- [ ] Does the interface still work with transparency reduced?
- [ ] Does the design remain performant on mobile hardware?

---

# 35. Prompt-Level Instruction for AI Design Generation

When this document is used as a prompt for an AI design or code-generation system, include the following instruction verbatim or nearly verbatim:

> Create a modern, iOS-inspired Liquid / Optical Glass interface rather than conventional frosted-glass glassmorphism.
>
> Glass must behave like an optical material, not a translucent white rectangle. Preserve environmental color and recognizable background forms through the material while applying restrained blur, subtle refraction, adaptive tint, directional specular highlights, and soft depth shadows.
>
> Avoid generic 2020-era glassmorphism, milky acrylic cards, glowing white borders, excessive blur, decorative gradient blobs, neon palettes, and repeated floating rectangles.
>
> Use continuous curvature, restrained color, high legibility, spatial hierarchy, and fluid material-aware motion. The result should feel clear, luminous, polished, and physically believable.

---

# 36. AI Generation Guidance

When producing a page from this system, reason in this order:

```text
1. What is the environment?
2. What content must remain readable?
3. Which elements actually need glass?
4. How transparent can each surface safely be?
5. How does the environment affect tint and diffusion?
6. Where is the dominant light source?
7. Where should highlights appear?
8. Does refraction add value here?
9. Are the shapes spatially related?
10. Is motion communicating continuity?
```

Do not start by creating cards.

Start by establishing the environment and hierarchy.

---

# 37. Recommended CSS Variables

```css
:root {
  /* text */
  --text-primary: #1F2923;
  --text-secondary: #455148;
  --text-muted: #758078;

  /* accent */
  --accent: #6B4EFF;
  --accent-hover: #5038E0;

  /* optical surfaces */
  --glass-clear-a: rgba(255,255,255,0.16);
  --glass-clear-b: rgba(255,255,255,0.06);

  --glass-balanced-a: rgba(255,255,255,0.22);
  --glass-balanced-b: rgba(255,255,255,0.09);

  --glass-dense-a: rgba(255,255,255,0.30);
  --glass-dense-b: rgba(255,255,255,0.14);

  /* edges */
  --edge-soft: rgba(255,255,255,0.20);
  --edge-highlight: rgba(255,255,255,0.44);

  /* shadows */
  --shadow-soft: rgba(20,30,25,0.05);
  --shadow-medium: rgba(20,30,25,0.08);

  /* geometry */
  --radius-lg: 30px;
  --radius-md: 22px;
  --radius-sm: 14px;
}
```

These values are starting points only.

Do not treat them as fixed tokens if the environment requires adaptation.

---

# 38. Reference Glass Component

```css
.optical-glass {
  position: relative;
  overflow: hidden;

  border-radius: var(--radius-lg);

  background:
    linear-gradient(
      145deg,
      var(--glass-balanced-a),
      var(--glass-balanced-b)
    );

  backdrop-filter:
    blur(18px)
    saturate(1.12);

  -webkit-backdrop-filter:
    blur(18px)
    saturate(1.12);

  border:
    1px solid var(--edge-soft);

  box-shadow:
    inset 0 1px 0 var(--edge-highlight),
    inset 1px 0 0 rgba(255,255,255,0.08),
    0 12px 30px var(--shadow-medium),
    0 2px 8px var(--shadow-soft);
}

.optical-glass::before {
  content: "";
  position: absolute;
  inset: 0;

  border-radius: inherit;
  pointer-events: none;

  background:
    linear-gradient(
      135deg,
      rgba(255,255,255,0.30) 0%,
      rgba(255,255,255,0.08) 20%,
      transparent 42%
    );

  opacity: 0.5;
}

.optical-glass::after {
  content: "";
  position: absolute;
  inset: auto 10% 0 10%;

  height: 1px;

  background:
    linear-gradient(
      90deg,
      transparent,
      rgba(255,255,255,0.18),
      transparent
    );

  opacity: 0.5;
}
```

This component should be customized per environment.

---

# 39. Reference Hover Behavior

```css
.optical-glass.interactive {
  transition:
    transform 180ms ease,
    box-shadow 180ms ease,
    background 180ms ease;
}

.optical-glass.interactive:hover {
  transform: translateY(-2px);

  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.50),
    inset 1px 0 0 rgba(255,255,255,0.10),
    0 16px 36px rgba(20,30,25,0.09),
    0 4px 10px rgba(20,30,25,0.05);
}
```

Do not use `scale()` for complex glass cards.

---

# 40. Reference Small Glass Control

```css
.glass-control {
  min-height: 44px;

  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;

  padding: 0 16px;

  border-radius: 999px;

  background:
    linear-gradient(
      145deg,
      rgba(255,255,255,0.18),
      rgba(255,255,255,0.06)
    );

  backdrop-filter: blur(12px) saturate(1.08);
  -webkit-backdrop-filter: blur(12px) saturate(1.08);

  border: 1px solid rgba(255,255,255,0.18);

  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.32),
    0 5px 14px rgba(20,30,25,0.05);
}
```

---

# 41. Reference Dense Text Panel

```css
.glass-text-panel {
  background:
    linear-gradient(
      145deg,
      rgba(255,255,255,0.34),
      rgba(255,255,255,0.16)
    );

  backdrop-filter:
    blur(24px)
    saturate(1.04);

  -webkit-backdrop-filter:
    blur(24px)
    saturate(1.04);

  border: 1px solid rgba(255,255,255,0.26);

  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.48),
    0 14px 34px rgba(20,30,25,0.08);
}
```

Use this for content that must remain readable over photography.

---

# 42. Data / Content Placeholders

The design system itself should remain reusable.

Use placeholders only in the page-specific section.

Suggested placeholder map:

```text
[PRODUCT_NAME]
[TAGLINE]
[SUBTITLE]
[PRIMARY_ACTION]
[SECONDARY_ACTION]

[HERO_MEDIA]
[HERO_METRIC]
[HERO_SUPPORTING_TEXT]

[NAV_ITEMS]
[FEATURES]
[STATS]
[CHART_DATA]
[MEDIA_ITEMS]
[TESTIMONIALS]

[PRICING_TIERS]
[CTA_LABEL]
[TRUST_TEXT]
```

Do not allow placeholder content to dictate the optical system.

---

# 43. Final Quality Standard

A finished interface should not immediately communicate:

> “This is a glassmorphism template.”

It should instead communicate:

> “This interface appears to be made from a coherent, translucent optical material.”

The material should support the content, not compete with it.

The best result is one where:

- the environment remains visible
- the glass feels physically present
- the text stays effortless to read
- the interface feels calm
- the material reacts naturally
- the design does not look generated from a trend template

---

# 44. Short Master Prompt

Use this condensed version when a shorter generation prompt is required:

> Design a modern, iOS-inspired Liquid / Optical Glass interface. Do not use conventional frosted-glass glassmorphism. Treat glass as a physical optical material that preserves environmental color and background forms while applying restrained blur, subtle refraction, adaptive tint, directional specular highlights, continuous curvature, and soft depth shadows. Avoid milky acrylic cards, uniform glowing borders, excessive blur, neon gradients, decorative orbs, repeated floating rectangles, and generic SaaS glassmorphism. Use restrained color, high legibility, fluid geometry, material-aware motion, and adaptive translucency. The result should feel luminous, clear, polished, quiet, and physically believable.
