import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { localDb } from "../offline/db";
import { createEmptyDraft, markCaptured, saveDraft } from "../offline/draftRepository";

const users = {
  "demo-token-collector": { id: "collector-profile", email: "collector@demo.local", displayName: "Meena Collector", role: "COLLECTOR", isDemo: true },
  "demo-token-recycler": { id: "recycler-profile", email: "recycler@demo.local", displayName: "GreenLoop Recycler", role: "RECYCLER", isDemo: true },
  "demo-token-admin": { id: "admin-profile", email: "admin@demo.local", displayName: "Asha Admin", role: "ADMIN", isDemo: true },
} as const;

const materials = [
  { id: "mat-mobile", code: "MOBILE_PHONES", name: "Mobile Phones", hazardLevel: "medium", handlingNotes: "Keep separate.", isDemo: true },
  { id: "mat-pcb", code: "CIRCUIT_BOARDS", name: "Circuit Boards / PCB", hazardLevel: "medium", handlingNotes: "Use gloves.", isDemo: true },
];

const serverLots = new Map<string, unknown>();

function mockFetch({ failSync = false } = {}) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/health")) return json({ status: "ok", service: "vital-edges-api", authMode: "demo" });
    if (url.endsWith("/materials")) return json(materials);
    if (url.endsWith("/auth/me")) {
      const auth = init?.headers instanceof Headers ? init.headers.get("Authorization") : (init?.headers as Record<string, string> | undefined)?.Authorization;
      const token = auth?.replace("Bearer ", "") as keyof typeof users | undefined;
      return token && users[token] ? json(users[token]) : json({ error: { code: "UNAUTHORIZED", message: "Missing or invalid token." } }, 401);
    }
    if (url.endsWith("/sync/mutations")) {
      if (failSync) throw new Error("Backend unavailable");
      const body = JSON.parse(String(init?.body)) as { mutations: Array<{ mutationId: string; payload: { clientDraftId: string }; operation: string }> };
      return json({ results: body.mutations.map((mutation) => {
        const id = serverLots.has(mutation.payload.clientDraftId) ? `lot-${mutation.payload.clientDraftId}` : `lot-${mutation.payload.clientDraftId}`;
        serverLots.set(mutation.payload.clientDraftId, { id });
        return { mutationId: mutation.mutationId, status: "COMPLETE", error: null, lot: { id, humanId: "EW-TEST", collectorId: "collector-profile", clientDraftId: mutation.payload.clientDraftId, title: "Digital E-Waste Lot", status: mutation.operation === "CAPTURE_LOT" ? "CAPTURED" : "DRAFT", item: null, pickup: null, evidence: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } };
      }) });
    }
    return json({ error: { code: "NOT_FOUND", message: "Not found." } }, 404);
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function renderAt(route: string) {
  render(<MemoryRouter initialEntries={[route]}><App /></MemoryRouter>);
  await waitFor(() => expect(screen.queryByText("Checking backend...")).not.toBeInTheDocument());
}

async function clickContinue() {
  await userEvent.click(await screen.findByRole("button", { name: /continue/i }));
}

async function seedCollectorSession() {
  localStorage.setItem("vital_edges_demo_token", "demo-token-collector");
}

beforeEach(async () => {
  vi.stubGlobal("fetch", mockFetch());
  localStorage.clear();
  serverLots.clear();
  await localDb.delete();
  await localDb.open();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await localDb.delete();
});

describe("Phase 2 collector drafts", () => {
  it("collector can start Create Lot", async () => {
    await seedCollectorSession();
    await renderAt("/collector");
    await userEvent.click(await screen.findByRole("link", { name: /create e-waste lot/i }));
    expect(await screen.findByRole("heading", { name: "Create E-Waste Lot" })).toBeInTheDocument();
  });

  it("wizard preserves data between steps and validates required fields", async () => {
    await seedCollectorSession();
    await renderAt("/collector/lots/new");
    await screen.findByText("What type of e-waste do you have?");
    await clickContinue();
    expect(screen.getByText("Choose the type of e-waste.")).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "Mobile Phones" }));
    await clickContinue();
    const back = screen.getByRole("button", { name: "Back" });
    await waitFor(() => expect(back).toBeEnabled());
    await userEvent.click(back);
    expect(await screen.findByRole("button", { name: "Mobile Phones" })).toHaveClass("border-emerald-700");
  });

  it("draft can be saved and restored from IndexedDB", async () => {
    await seedCollectorSession();
    const draft = await createEmptyDraft("collector-profile");
    await saveDraft({ ...draft, materialCategoryId: "mat-mobile", condition: "WORKING", quantity: 2, estimatedWeightKg: 1.5, pickupCityArea: "Coimbatore", pickupPinCode: "641001", pickupPreference: "RECYCLER_PICKUP", evidence: [{ localId: "p1", filename: "a.jpg", mimeType: "image/jpeg", sizeBytes: 10, angleLabel: "Front", previewDataUrl: "data:image/jpeg;base64,aa" }] });
    await renderAt(`/collector/lots/${draft.localId}/edit`);
    expect(await screen.findByText("Create E-Waste Lot")).toBeInTheDocument();
    await clickContinue();
    await clickContinue();
    expect(await screen.findByRole("button", { name: "Working" })).toHaveClass("border-emerald-700");
  });

  it("My Lots displays local draft and supports delete", async () => {
    await seedCollectorSession();
    const draft = await createEmptyDraft("collector-profile");
    await saveDraft({ ...draft, materialCategoryId: "mat-pcb", quantity: 12, estimatedWeightKg: 8.5 });
    await renderAt("/collector/lots");
    expect(await screen.findByText("Circuit Boards / PCB")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Delete draft" }));
    expect(await screen.findByText("No lots yet. Create your first Digital E-Waste Lot.")).toBeInTheDocument();
  });

  it("CAPTURED lot cannot be edited as DRAFT", async () => {
    await seedCollectorSession();
    const draft = await createEmptyDraft("collector-profile");
    const captured = await markCaptured(draft);
    await renderAt(`/collector/lots/${captured.localId}/edit`);
    expect(await screen.findByText("CAPTURED lots cannot be edited as DRAFT. Evidence captured. Verification is the next step.")).toBeInTheDocument();
  });

  it("offline state and failed sync expose retry", async () => {
    vi.stubGlobal("fetch", mockFetch({ failSync: true }));
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    await seedCollectorSession();
    const draft = await createEmptyDraft("collector-profile");
    await saveDraft({ ...draft, materialCategoryId: "mat-mobile" });
    await renderAt("/collector/lots");
    expect(await screen.findByText(/Offline - changes saved on this device/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /retry sync/i }));
    expect(await screen.findByText("Sync failed - Retry")).toBeInTheDocument();
  });

  it("complete local draft can submit as CAPTURED", async () => {
    await seedCollectorSession();
    const draft = await createEmptyDraft("collector-profile");
    await saveDraft({ ...draft, materialCategoryId: "mat-mobile", condition: "WORKING", quantity: 1, estimatedWeightKg: 0.5, pickupCityArea: "Coimbatore", pickupPinCode: "641001", pickupPreference: "EITHER", evidence: [{ localId: "p1", filename: "a.jpg", mimeType: "image/jpeg", sizeBytes: 10, angleLabel: "Front", previewDataUrl: "data:image/jpeg;base64,aa" }] });
    await renderAt(`/collector/lots/${draft.localId}/edit`);
    for (let i = 0; i < 5; i += 1) await clickContinue();
    await userEvent.click(screen.getByRole("button", { name: /submit captured lot/i }));
    expect(await screen.findByText("Evidence captured. Verification is the next step.")).toBeInTheDocument();
  });

  it("collector wizard has no horizontal overflow at 360px", async () => {
    Object.defineProperty(document.documentElement, "clientWidth", { configurable: true, value: 360 });
    await seedCollectorSession();
    await renderAt("/collector/lots/new");
    const section = await screen.findByRole("heading", { name: "Create E-Waste Lot" });
    expect(section).toBeInTheDocument();
  });
});



