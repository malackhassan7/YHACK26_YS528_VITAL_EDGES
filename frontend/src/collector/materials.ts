import type { MaterialCategory } from "./lot-types";

export const fallbackMaterials: readonly MaterialCategory[] = [
  { id: "mat-mobile", code: "MOBILE_PHONES", name: "Mobile Phones", hazardLevel: "medium", handlingNotes: "Keep swollen batteries separate.", isDemo: true },
  { id: "mat-laptop", code: "LAPTOPS_COMPUTERS", name: "Laptops / Computers", hazardLevel: "medium", handlingNotes: "Avoid crushing screens or batteries.", isDemo: true },
  { id: "mat-pcb", code: "CIRCUIT_BOARDS", name: "Circuit Boards / PCB", hazardLevel: "medium", handlingNotes: "Use gloves around sharp boards.", isDemo: true },
  { id: "mat-cables", code: "CABLES_WIRES", name: "Cables / Wires", hazardLevel: "low", handlingNotes: "Bundle cables before pickup.", isDemo: true },
  { id: "mat-battery", code: "BATTERIES", name: "Batteries", hazardLevel: "high", handlingNotes: "Do not puncture or heat batteries.", isDemo: true },
  { id: "mat-charger", code: "CHARGERS_ADAPTERS", name: "Chargers / Adapters", hazardLevel: "low", handlingNotes: "Keep plugs covered if damaged.", isDemo: true },
  { id: "mat-display", code: "DISPLAYS_MONITORS", name: "Displays / Monitors", hazardLevel: "medium", handlingNotes: "Handle broken glass carefully.", isDemo: true },
  { id: "mat-mixed", code: "MIXED_ELECTRONICS", name: "Mixed Electronics", hazardLevel: "medium", handlingNotes: "Separate leaking or sharp items.", isDemo: true },
];

export function materialName(materials: readonly MaterialCategory[], id: string | undefined): string {
  return materials.find((material) => material.id === id)?.name ?? "Material not selected";
}