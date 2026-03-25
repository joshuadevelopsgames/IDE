# Dream IDE — Design Brainstorm

## Context
Building a desktop-class IDE UI (web prototype) that rivals Cursor. The interface must feel like a professional development environment with an integrated AI agent (Hermes). Key screens: project picker, workspace (file tree + editor + run panel), chat thread, approvals queue, settings.

---

<response>
## Idea 1: "Obsidian Forge" — Industrial Precision

<text>
**Design Movement:** Neo-Industrial / Dark Foundry — inspired by precision engineering tools, CNC interfaces, and dark-room photography. Think carbon fiber textures, machined metal edges, and amber indicator lights.

**Core Principles:**
1. **Functional density** — maximize information per pixel without clutter; every element earns its space
2. **Tactile feedback** — UI elements feel like physical controls (toggles click, panels slide with weight)
3. **Status-first hierarchy** — the most important thing is always "what is the agent doing right now?"
4. **Zero chrome waste** — borders and dividers are structural, never decorative

**Color Philosophy:**
- Base: Deep charcoal (#0D0F12) with warm graphite panels (#161A1F)
- Accent: Amber/gold (#E8A838) for active states and agent activity — evokes "forge heat"
- Success: Muted teal (#3AAFA9)
- Danger: Burnt coral (#E74C3C)
- Text: Cool white (#E8ECF1) primary, slate (#8892A0) secondary
- Reasoning: Dark environments reduce eye strain during long coding sessions; amber draws attention without the cliché of blue/purple

**Layout Paradigm:**
- Three-column asymmetric: narrow file tree (220px) | dominant editor (flex) | collapsible right panel (380px) for agent/chat
- Top bar is a thin command strip (36px) — no wasted vertical space
- Bottom status bar with real-time agent heartbeat indicator
- Panels use hard edges, not rounded corners — precision, not friendliness

**Signature Elements:**
1. **Forge Pulse** — a subtle amber glow line that pulses along panel borders when the agent is actively working
2. **Step Ticker** — agent plan steps rendered as a vertical timeline with industrial-style status dots (hollow = pending, filled = complete, pulsing = active)
3. **Approval Stamp** — risky actions appear as physical-looking "stamp cards" with clear Allow/Deny buttons

**Interaction Philosophy:**
- Keyboard-first; every action has a shortcut
- Panels resize with snap points and subtle resistance
- Context menus appear instantly, no animation delay
- Drag-and-drop for file operations with ghost preview

**Animation:**
- Minimal, purposeful: 150ms ease-out for panel transitions
- Agent activity: smooth amber pulse (CSS animation, 2s cycle)
- Step completion: brief scale-up (1.02x) then settle
- No bouncing, no spring physics — everything moves with mechanical precision
- Diff highlights fade in over 200ms

**Typography System:**
- Display/Headers: JetBrains Mono (bold) — monospace authority
- Body/UI: IBM Plex Sans (400/500/600) — engineered readability
- Code: JetBrains Mono (regular) — consistent with headers
- Size scale: 11px code, 12px UI labels, 13px body, 16px section headers, 20px page titles
</text>

<probability>0.08</probability>
</response>

---

<response>
## Idea 2: "Vapor Studio" — Ethereal Minimalism

<text>
**Design Movement:** Digital Etherealism / Glass Morphism 2.0 — inspired by frosted glass, atmospheric fog, and the translucency of modern OS design (macOS Sequoia, Windows Fluent). Soft, layered, breathable.

**Core Principles:**
1. **Layered transparency** — depth through overlapping translucent surfaces, not borders
2. **Breathing room** — generous padding, content never feels cramped
3. **Gentle authority** — the AI agent feels like a calm collaborator, not an aggressive tool
4. **Progressive disclosure** — complexity reveals itself only when needed

**Color Philosophy:**
- Base: Near-black with blue undertone (#0C0E14) — deep space
- Surfaces: Semi-transparent layers with backdrop-blur (rgba(255,255,255,0.04) to 0.08)
- Accent: Electric cyan (#00D4FF) for agent states — feels alive, digital
- Secondary accent: Soft violet (#A78BFA) for selections and highlights
- Success: Mint (#34D399)
- Danger: Rose (#FB7185)
- Text: Pure white (#FFFFFF) at 90% opacity primary, 50% opacity secondary
- Reasoning: Translucent layers create natural depth hierarchy; cyan accent is energetic but not aggressive

**Layout Paradigm:**
- Floating panel architecture: panels appear as frosted glass cards hovering over a dark canvas
- File tree slides out as an overlay, not a permanent column — maximizes editor space
- Agent panel is a slide-over drawer from the right with blur backdrop
- No hard grid — panels have 8px gaps between them, creating a "floating" effect

**Signature Elements:**
1. **Glass Cards** — every panel is a frosted glass surface with 1px luminous border (white at 10% opacity)
2. **Breath Indicator** — agent status shown as a softly pulsing orb that "breathes" (scale + opacity cycle)
3. **Cascade Timeline** — agent steps cascade downward like cards in a waterfall, each slightly overlapping

**Interaction Philosophy:**
- Hover reveals additional context (tooltips, expanded info)
- Panels slide with spring physics (framer-motion)
- Focus states use a soft glow rather than hard outlines
- Everything feels like it floats — no hard anchoring

**Animation:**
- Spring-based transitions: stiffness 300, damping 30
- Panel open/close: slide + fade with backdrop blur transition
- Agent thinking: breathing orb (scale 0.95-1.05, opacity 0.6-1.0, 3s cycle)
- Step completion: card slides up and settles with gentle bounce
- Hover: 200ms scale(1.01) with box-shadow expansion
- Page transitions: crossfade 300ms

**Typography System:**
- Display/Headers: Space Grotesk (500/700) — geometric, modern, distinctive
- Body/UI: Inter Variable (400/500) — but used sparingly with generous letter-spacing
- Code: Fira Code (regular) — ligatures for readability
- Size scale: 12px code, 13px UI, 14px body, 18px section headers, 24px page titles
- Letter-spacing: +0.01em on body, +0.05em on uppercase labels
</text>

<probability>0.06</probability>
</response>

---

<response>
## Idea 3: "Terminal Noir" — Hacker Aesthetic

<text>
**Design Movement:** Retro-Terminal / Cyberpunk Minimalism — inspired by CRT monitors, classic terminal emulators, and the raw power of text-based interfaces. Think green-on-black, scan lines, and monospace everything.

**Core Principles:**
1. **Text is king** — everything is expressed through text and symbols, minimal iconography
2. **Raw honesty** — show exactly what the agent is doing, no abstraction layers
3. **Speed over beauty** — interface loads instantly, responds instantly, wastes nothing
4. **Hacker respect** — treats the user as an expert; no hand-holding UI

**Color Philosophy:**
- Base: True black (#000000) with very dark gray panels (#0A0A0A)
- Primary text: Phosphor green (#00FF41) — classic terminal
- Accent: Amber (#FFB000) for warnings and agent activity
- Secondary: Cyan (#00E5FF) for links and interactive elements
- Danger: Red (#FF3333)
- Muted: Dark green (#1A3A1A) for backgrounds of active elements
- Reasoning: Maximum contrast, zero ambiguity; the green-on-black is instantly recognizable and reduces eye strain in dark environments

**Layout Paradigm:**
- Full-bleed monospace grid: everything aligns to a character grid
- Vertical split: left 40% file tree + editor tabs, right 60% editor + bottom terminal
- Agent output streams inline like terminal output — no separate panel needed
- Borders are single-pixel lines or ASCII box-drawing characters rendered in CSS

**Signature Elements:**
1. **Scan Line Overlay** — subtle CSS scan lines (2px repeating gradient at 3% opacity) over the entire viewport
2. **Command Prompt** — agent interactions styled as terminal I/O with `>` prompts and `$` prefixes
3. **Matrix Rain** — idle state shows very faint falling characters in the background (canvas, 5% opacity)

**Interaction Philosophy:**
- Command palette is THE primary navigation (Ctrl+K)
- Mouse is supported but keyboard is faster for everything
- No dropdowns — use fuzzy-search lists
- Right-click context menus styled as terminal menus

**Animation:**
- Typewriter effect for agent responses (character by character, 20ms per char)
- Cursor blink: classic block cursor, 530ms interval
- Panel transitions: instant (0ms) — no animation, just cut
- New content: fade-in 100ms from 0 opacity
- Scan line drift: continuous subtle vertical scroll (60s cycle)

**Typography System:**
- Everything: JetBrains Mono or Fira Code — monospace only, no exceptions
- Hierarchy through weight (300/400/700) and color, not size variation
- Size: 13px base, 14px headers, 11px status bar
- Line-height: 1.6 for readability
- No italics — use color differentiation instead
</text>

<probability>0.04</probability>
</response>
