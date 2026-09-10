---
name: Kabaad Seva
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#3e4943'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#6e7a73'
  outline-variant: '#bdc9c1'
  surface-tint: '#006c4e'
  primary: '#005d42'
  on-primary: '#ffffff'
  primary-container: '#047857'
  on-primary-container: '#9ffdd3'
  inverse-primary: '#7bd8b1'
  secondary: '#006398'
  on-secondary: '#ffffff'
  secondary-container: '#5bb8fe'
  on-secondary-container: '#00476e'
  tertiary: '#7d4200'
  on-tertiary: '#ffffff'
  tertiary-container: '#a05600'
  on-tertiary-container: '#ffe5d3'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#97f5cc'
  primary-fixed-dim: '#7bd8b1'
  on-primary-fixed: '#002115'
  on-primary-fixed-variant: '#00513a'
  secondary-fixed: '#cce5ff'
  secondary-fixed-dim: '#93ccff'
  on-secondary-fixed: '#001d31'
  on-secondary-fixed-variant: '#004b73'
  tertiary-fixed: '#ffdcc3'
  tertiary-fixed-dim: '#ffb77d'
  on-tertiary-fixed: '#2f1500'
  on-tertiary-fixed-variant: '#6e3900'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display:
    fontFamily: Noto Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg:
    fontFamily: Noto Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Noto Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Noto Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  title-lg:
    fontFamily: Noto Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  title-md:
    fontFamily: Noto Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  body-lg:
    fontFamily: Noto Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Noto Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Noto Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Noto Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.1px
  label-md:
    fontFamily: Noto Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.25px
  label-sm:
    fontFamily: Noto Sans
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.5px
  currency-display:
    fontFamily: Noto Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  touch-target: 3.5rem
  screen-margin: 1rem
  card-padding: 1rem
  stack-gap-sm: 0.5rem
  stack-gap-md: 0.75rem
  stack-gap-lg: 1rem
  section-gap: 1.5rem
  inline-gap: 0.5rem
---

## Brand & Style
The design system reflects an accessible, high-trust digital utility tailored for informal scrap collectors (*kabadiwalas*), aggregators, and everyday households across urban and semi-urban India. The aesthetic blends the credibility and civic reliability of modern public digital infrastructure (such as UPI or DigiLocker) with the immediate, tactile clarity of field-ready logistics software.

Key attributes:
- **Pragmatic and Honest:** Interfaces prioritize functional legibility, clear financial metrics, and high-visibility transaction tracking over decorative excess.
- **Dignified Utility:** Visual styling elevates daily recycling work into essential green urban infrastructure through a dignified, calm palette.
- **Low-Literacy & Vernacular Resilient:** High reliance on recognizable iconography, bold numeric weights, color coding, and spacious touch regions ensure frictionless operation under outdoor glare, single-handed operation on low-cost Android hardware, and varying degrees of textual literacy.

## Colors
The color palette delivers high-contrast readability, immediate status communication, and outdoor legibility. The background relies on `#F8FAFC` (Slate-50) rather than pure white to reduce visual fatigue and maintain container contrast on lower-tier IPS displays.

### Primary (`#047857` Emerald)
Represents ecology, transaction success, and economic livelihood. Used for primary calls-to-action, active bottom tab highlights, rate-card tickers, and successful pickup verification banners.

### Secondary (`#0284C7` Sky / Blue)
Denotes logistics, route status, weighing scale pairing, and active collection requests. Used for navigation prompts, order assignment tags, and secondary interactions.

### Tertiary (`#D97706` Amber)
Reserved for pending verification, pending payments, cash reconciliation alerts, and weight discrepancy notices.

### Neutral System
- **Base Canvas:** `#F8FAFC` (Slate-50)
- **Card/Surface:** `#FFFFFF` (Pure White)
- **Borders & Dividers:** `#E2E8F0` (Slate-200) for structural division and 1px field definitions.
- **Text Primary:** `#0F172A` (Slate-900) ensures AAA accessibility across backgrounds.
- **Text Secondary / Icons:** `#475569` (Slate-600) for timestamps, secondary units, and helper labels.
- **Muted / Disabled:** `#94A3B8` (Slate-400)

## Typography
Typography is anchored on **Noto Sans** to guarantee flawless glyph rendering, diacritic support, and aesthetic parity across English and Indic scripts (Hindi, Marathi, Bengali, Tamil, Telugu, Kannada, Gujarati, and Punjabi).

### Numerical Hierarchy
Weights and sizes are amplified for currency (`₹`) and weight (`kg`) values. `currency-display` ensures that daily earnings, scrap weights, and payout figures can be confirmed at a quick glance in direct sunlight during curbside collection.

### Vertical Rhythm & Scaling
- Body text maintains a minimum size of 14px (`body-md`) with 20px line heights for dense informational scanning.
- Disclaimers and metadata do not drop below 12px (`body-sm`) or 10px (`label-sm` for badges only) to remain legible on compact smartphone screens.

## Layout & Spacing
The layout adheres strictly to an 8dp grid system engineered for touch reliability in transit and physical field settings.

- **4-Column Mobile Grid:** 16px screen margins (`screen-margin`), 12px gutters, and 100% fluid card widths.
- **Mandatory 56dp Touch Target:** All critical primary controls, quick-filter chips, and numeric stepper buttons maintain a minimum boundary of 56px (`touch-target` / `3.5rem`) to accommodate single-hand use with thumb reach.
- **Visual Stacking:** Vertical cards use consistent gaps of 12px (`stack-gap-md`) or 16px (`stack-gap-lg`), with sectional separations locked at 24px (`section-gap`).
- **Safe Area Anchors:** Bottom action bars are fixed with a minimum height of 72px (including safe area offsets) to prevent accidental hardware gesture mis-taps.

## Elevation & Depth
Depth conveys physical order and operational priority without adding visual clutter or heavy drop shadows that blur on budget LCD displays.

### Low-Contrast Border Layering
Primary elevation is achieved by layering pure white containers (`#FFFFFF`) against the `#F8FAFC` canvas, bordered with an explicit 1px stroke of `#E2E8F0`.

### Shadow Scale
- **Flat Surface (Level 0):** Used for non-interactive cards and grouped lists. 1px border `#E2E8F0`, no shadow.
- **Resting Action Surface (Level 1):** Standard scrap category and pickup request cards. `box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.04);` with 1px `#E2E8F0` border.
- **Floating / Sticky Controls (Level 2):** Floating Action Buttons, quick-dial controls, and bottom navigation ribbons. `box-shadow: 0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 2px 6px -2px rgba(15, 23, 42, 0.04);`.
- **Modal Sheets (Level 3):** Bottom sliding confirmation sheets for scale weighing readouts and payment QR displays. `box-shadow: 0 12px 24px -4px rgba(15, 23, 42, 0.16);`.

## Shapes
Roundedness scale `2` provides a balanced, approachable feel without compromising screen real estate.

- **Small Components (Badges, Quantity Indicators):** 8px (`0.5rem`) border-radius.
- **Inputs & Action Buttons:** 12px (`0.75rem`) border-radius, maintaining clear visual definition at 56px heights.
- **Cards & Surface Containers:** 16px (`1rem`) border-radius (`rounded-lg`), creating friendly, well-defined blocks.
- **Bottom Sheets:** Top edges utilize 24px (`1.5rem`) border-radius for an ergonomic drawer appearance.
- **Pill Shapes:** Strictly reserved for status tags (e.g., "Assigned", "Paid", "Pending Pickup") and vernacular language switcher toggles.

## Components

### Buttons
- **Primary CTA:** Minimum height 56px. Solid `#047857` background, pure white `#FFFFFF` text, `title-lg` typography, fully centered with optional 24px leading icon. Active state: `#065F46`.
- **Secondary CTA:** Minimum height 56px. White `#FFFFFF` background with a 1.5px solid `#E2E8F0` border, `#0F172A` text, and `#F1F5F9` on pressed state.
- **Destructive / Cancellation:** Transparent background with `#DC2626` text, 48px minimum touch target.

### Status Badges
Pill-shaped containers with a minimum height of 28px and 12px horizontal padding:
- **Emerald (Completed / Paid):** Background `#ECFDF5`, border `#A7F3D0`, text `#047857`.
- **Blue (Active / In Transit):** Background `#F0F9FF`, border `#BAE6FD`, text `#0284C7`.
- **Amber (Pending / Weighing Needed):** Background `#FFFBEB`, border `#FDE68A`, text `#B45309`.

### Input Fields & Steppers
- **Text / Number Inputs:** 56px height, 1px `#E2E8F0` border, `#FFFFFF` fill, `#0F172A` text. Focused state triggers a 2px `#047857` outline with zero horizontal jitter.
- **Scrap Weight Stepper:** Dual large touch buttons (`-` and `+`) each measuring 56x56px with high-contrast icons flanking an oversized numeric input (24px bold font), permitting quick manual adjustments without fine motor precision.

### Cards
- **Pickup Request Card:** White `#FFFFFF` background, 1px `#E2E8F0` border, 16px internal padding. Features high-contrast category icons (Iron, Cardboard, Plastic, Copper), localized material names, timestamp, dynamic status badge at top right, and an explicit full-width action button docked at the bottom.

### Lists
- Dividers are 1px solid `#E2E8F0` inset by 16px from left and right boundaries.
- Row heights default to 64px to easily accommodate avatar/scrap icon, multi-line titles, and trailing currency metrics.

### Hardware & Field Extensions
- **Weighing Scale Bluetooth Indicator:** Compact status card with pulsing green indicator (`#047857`) and digital weight display synced in real time.
- **Offline Sync Banner:** Sticky top-strip in amber tone (`#FFFBEB`) with dark amber text (`#92400E`) warning collectors of pending sync status in low-connectivity areas.