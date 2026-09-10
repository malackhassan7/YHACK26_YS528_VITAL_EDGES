---
name: Industrial Compliance & Circular Chain UI
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3e4943'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6e7a73'
  outline-variant: '#bdc9c1'
  surface-tint: '#006c4e'
  primary: '#005d42'
  on-primary: '#ffffff'
  primary-container: '#047857'
  on-primary-container: '#9ffdd3'
  inverse-primary: '#7bd8b1'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
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
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#ffdcc3'
  tertiary-fixed-dim: '#ffb77d'
  on-tertiary-fixed: '#2f1500'
  on-tertiary-fixed-variant: '#6e3900'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.03em
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  space-2xs: 0.125rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-base: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
  layout-margin-mobile: 1rem
  layout-margin-desktop: 1.5rem
  gutter-default: 1rem
---

## Brand & Style

This design system serves an authorized e-waste dismantling, recycling, and statutory CPCB (Central Pollution Control Board) EPR compliance platform operating across industrial India. 

The aesthetic is **Industrial Precision Corporate**: authoritative, audit-ready, institutional, and relentlessly structured. It avoids playful consumer motifs in favor of the unyielding clarity required by plant managers, environmental compliance officers, and customs auditors. High-density data tables, manifest tracking, hazardous material manifests, and mass balance calculations demand absolute legibility and spatial discipline.

Visual tone attributes:
- **Statutory Authority**: Heavy visual reliance on formal, verifiable status treatments (CPCB credit badges, chain-of-custody seals, non-compliance alerts).
- **Physical-to-Digital Parity**: Mimics the functional utility of high-grade industrial weighbridge readouts, inspection forms, and freight manifests without retro skeuomorphism.
- **High Tactical Contrast**: Critical operational states—such as EPR quota deficits, hazardous material flag thresholds, and transport vehicle detention—command immediate visual triage through razor-sharp warning and error signaling.

## Colors

The system relies on a high-clarity technical palette built upon crisp architectural slate neutrals, deep verified emeralds, and precise operational semantic tones.

### Surface & Foundation
- **Canvas Base**: Slate-50 (`#F8FAFC`) forms the operational background, reducing eye strain during multi-hour data entry shifts.
- **Card & Data Surface**: Pure White (`#FFFFFF`) ensures distinct foreground grouping against the slate floor.
- **Dividers & Structural Borders**: Slate-200 (`#E2E8F0`) acts as a crisp 1px delineation grid. In data-dense tables or inset forms, Slate-100 (`#F1F5F9`) provides soft cell boundaries.

### Brand & Authority Accents
- **Primary (Verified Recycling / Statutory Compliance)**: Deep Emerald-700 (`#047857`). Represents authenticated lifecycle destruction, verified EPR credits, and certified weights. Paired with Emerald-50 (`#ECFDF5`) for container backgrounds and Emerald-100 (`#D1FAE5`) for validated badge borders.
- **Secondary (Heavy Slate / Structural Command)**: Slate-900 (`#0F172A`). Used for high-impact metric headers, primary command buttons, and core shell navigation framing.

### Operational Semantics
- **Urgent / Regulatory Violation**: Red-600 (`#DC2626`) backed by Red-50 (`#FEF2F2`) and Red-200 (`#FECACA`). Used for hazardous discrepancy alerts, expired transit permits, and audit failure risks.
- **Warning / Quota Threshold**: Amber-600 (`#D97706`) paired with Amber-50 (`#FFFBEB`). Flags pending gate passes, nearing mass-balance variance limits, and calibration deadlines.
- **Typography Scale**:
  - Primary Content / Heavy Metric: Slate-900 (`#0F172A`)
  - Secondary Data / Table Columns: Slate-600 (`#475569`)
  - Subtle Labels / Meta / Timestamps: Slate-500 (`#64748B`)

## Typography

Typography delivers dense, scannable data layouts. **Inter** is the primary font family across all standard text blocks, table rows, and navigational items due to its tall x-height and mechanical legibility. All numeral metrics, weights, capacities, and currency values must enable tabular figures (`font-variant-numeric: tabular-nums`) to prevent horizontal jitter during real-time weight scales and metric telemetry updates.

**JetBrains Mono** is mandatory for all Lot Numbers (`LOT-2024-DEL-9812`), Consignment IDs, CPCB Registration Tokens, HSN/EWC codes, and GPS Geo-fence coordinates. It signals immutable industrial recordkeeping.

## Layout & Spacing

The layout model uses a dense, responsive fluid grid anchored inside a continuous application frame.

- **Grid Architecture**: 12-column grid system with 16px (`1rem`) gutters on desktop screens (>=1024px) and 12px gutters on tablet/mobile devices. 
- **Screen Margins**: Desktop uses 24px (`1.5rem`) outer page margins. Mobile compresses to 16px (`1rem`).
- **Data Density**: Metrics dashboards utilize compact 8px/12px inner vertical pacing inside cards to maximize visual payload above the fold. 
- **Responsive Handling**:
  - **Desktop (>=1280px)**: Persistent 260px left sidebar for operational modules (Inward Logistics, Dismantling Yard, Mass Balance, CPCB Filing, Trading Desk).
  - **Tablet (768px - 1023px)**: Left navigation folds into a slim 64px icon rail; dual-column summary cards collapse into single stacked columns.
  - **Mobile (<768px)**: Inward weighbridge manifests collapse from multi-column tables to vertical key-value transaction cards. Sticky bottom action bars house primary confirmation triggers (e.g., "Accept Gross Weight").

## Elevation & Depth

This design system rejects heavy blur or multi-point drop shadows. Depth is communicated primarily through **Tonal Layers** and **Low-Contrast Outlines** to simulate the feel of clean precision instruments.

- **Level 0 (Canvas Base)**: `#F8FAFC` flat surface.
- **Level 1 (Card & Section Containers)**: `#FFFFFF` fill bounded by a crisp 1px solid border in `#E2E8F0`. No shadow is applied under normal conditions.
- **Level 2 (Interactive Floating Overlays & Flyout Panels)**: Weighbridge manual overrides, batch lot selectors, and manifest detail drawers use `#FFFFFF` with a single directional hairline shadow: `0 4px 6px -1px rgba(15, 23, 42, 0.06), 0 2px 4px -2px rgba(15, 23, 42, 0.04)` enclosed in a 1px `#CBD5E1` boundary.
- **Level 3 (Modal & Audit Dialogues)**: Audit verification sign-offs and CPCB XML generation modals use `0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.06)` with a 40% `#0F172A` backdrop scrim.

## Shapes

The design system enforces a **Soft (Level 1)** geometric standard. Enterprise compliance tools require a sharp, utilitarian structural cadence; overly rounded elements undermine data authority and consume excess vertical/horizontal space.

- **Base Corner Radius (`rounded`)**: 4px (`0.25rem`). Applied to buttons, input controls, metric micro-cards, and data table headers.
- **Container Radius (`rounded-lg`)**: 8px (`0.5rem`). Applied to main dashboard metric widgets, compliance checklist cards, and modal containers.
- **Pill Exceptions (`rounded-full`)**: Strictly reserved for micro status pills (e.g., "Form-6 Generated", "Weighed In", "Discrepancy Detected") and circular live state indicators.

## Components

### Buttons
- **Primary Operational Button**: Background Deep Emerald-700 (`#047857`), text White (`#FFFFFF`), hover Deep Emerald-800 (`#065F46`), border 1px solid transparent, border-radius 4px, font Inter semi-bold, 14px. Used for official actions: "Validate Manifest", "Issue EPR Certificate", "Commit Tare Weight".
- **Secondary Action Button**: Background White (`#FFFFFF`), text Slate-700 (`#334155`), border 1px solid Slate-300 (`#CBD5E1`), hover Slate-50 (`#F8FAFC`).
- **Destructive Command Button**: Background Red-600 (`#DC2626`), text White (`#FFFFFF`), hover Red-700 (`#B91C1C`). Used for flagging illegal shipments, quarantine orders, or audit rejection.
- **Density**: Height standard is 36px for default interfaces; 32px for high-density tabular toolbars.

### Status Badges & Compliance Chips
- Fixed height: 22px, padding: 0 8px, border-radius: 9999px.
- **Compliant / Certified**: Background Emerald-50 (`#ECFDF5`), text Emerald-800 (`#065F46`), border 1px solid Emerald-200 (`#A7F3D0`).
- **Quarantine / Breach**: Background Red-50 (`#FEF2F2`), text Red-800 (`#991B1B`), border 1px solid Red-200 (`#FECACA`).
- **In-Transit / Weighbridge Pending**: Background Amber-50 (`#FFFBEB`), text Amber-800 (`#92400E`), border 1px solid Amber-200 (`#FDE68A`).
- **Lot Number Tags**: JetBrains Mono 11px, background Slate-100 (`#F1F5F9`), text Slate-700 (`#334155`), border 1px solid Slate-300 (`#CBD5E1`), radius 4px.

### Inputs & Inspection Forms
- Inputs feature a crisp 1px border in Slate-300 (`#CBD5E1`), White background, and Slate-900 text.
- Focus state switches border to Emerald-600 (`#059669`) accompanied by a 1px ring in Emerald-100 (`#D1FAE5`).
- Input height: 36px (compact industrial density) with 12px horizontal padding. Tabular figures must be enabled by default for scale weight entries.

### Checkboxes & Radio Controls
- Base: 16px × 16px with 3px corner radius for checkboxes.
- Border: Slate-400 (`#94A3B8`). Selected fill: Deep Emerald-700 (`#047857`) with a solid white indicator.

### Data Tables (Industrial Manifests)
- **Header**: Height 36px, background Slate-100 (`#F1F5F9`), text Slate-600 (`#475569`), uppercase 11px Inter medium, 0.05em tracking.
- **Rows**: Height 44px, border-bottom 1px solid Slate-200 (`#E2E8F0`), alternating hover state in Slate-50 (`#F8FAFC`).
- **Numeric Alignment**: Weights (MT), EPR Credit Points, and Billing values are aligned flush-right using JetBrains Mono or tabular-figured Inter.

### Specialized Components
- **Mass Balance Variance Gauge**: Split-bar metric indicator showing Inward Weight vs. Dismantled Fractions (PCBs, Plastics, Precious Metals, Hazardous Slag). Discrepancy > 1.5% renders trailing segment in Red-600 automatically.
- **CPCB Audit Lock Banner**: Inset callout with 4px left-border accent in Emerald-700, informing compliance personnel of tamper-evident SHA-256 manifest hashing prior to government portal sync.