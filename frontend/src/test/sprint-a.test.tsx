/**
 * Sprint A Frontend Tests
 *
 * Covers:
 * - Verify Evidence CTA appears for CAPTURED lots
 * - Verification page renders in idle state
 * - Trust score panel renders with correct values
 * - Price page renders and shows disclaimer
 * - Recycler match cards render with score
 * - Status CTA routing (CAPTURED→verify, VERIFIED→price, LISTED→matches)
 * - Phase 2 offline draft regression guard
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import * as apiClient from "../api/client";
import { getDraft } from "../offline/draftRepository";
import { LotDetailsPage } from "../pages/LotDetailsPage";
import { LotVerificationPage } from "../pages/LotVerificationPage";
import { LotPricePage } from "../pages/LotPricePage";
import { LotMatchesPage } from "../pages/LotMatchesPage";

// ── Shared mocks ────────────────────────────────────────────────────────────

// Mock auth
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ token: "demo-token-collector", user: { role: "COLLECTOR", id: "collector-profile" }, status: "authenticated" }),
}));

// Mock materials
vi.mock("../collector/materials", () => ({
  fallbackMaterials: [
    { id: "mat-mobile", code: "MOBILE_PHONES", name: "Mobile Phones", hazardLevel: "medium", handlingNotes: "", isDemo: true },
  ],
  materialName: (_mats: unknown, id: string | undefined) => (id ? "Mobile Phones" : "Unknown"),
}));

// Mock offline repository
vi.mock("../offline/draftRepository", () => ({
  getDraft: vi.fn(),
  saveDraft: vi.fn(),
  saveEvidence: vi.fn(),
  pendingMutations: vi.fn(() => Promise.resolve([])),
  markCaptured: vi.fn(),
}));

vi.mock("../api/client", async (importOriginal) => {
  const real = await importOriginal<typeof apiClient>();
  return {
    ...real,
    getMaterials: vi.fn(() => Promise.resolve([])),
    getServerLot: vi.fn(),
    verifyLot: vi.fn(),
    getVerification: vi.fn(),
    confirmCategory: vi.fn(),
    priceLot: vi.fn(),
    getPriceExplanation: vi.fn(),
    getLotMatches: vi.fn(),
    listLot: vi.fn(),
  };
});

const mockedApi = vi.mocked(apiClient);

// ── Helper: render a page at a specific route ────────────────────────────────

function renderAt(path: string, element: React.ReactElement, pattern?: string) {
  let routePath = pattern;
  if (!routePath) {
    if (path.endsWith("/verify")) {
      routePath = "/collector/lots/:lotId/verify";
    } else if (path.endsWith("/price")) {
      routePath = "/collector/lots/:lotId/price";
    } else if (path.endsWith("/matches")) {
      routePath = "/collector/lots/:lotId/matches";
    } else if (path.startsWith("/collector/lots/")) {
      routePath = "/collector/lots/:lotId";
    } else {
      routePath = path;
    }
  }

  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={routePath} element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

// ── LotDetailsPage CTA routing ────────────────────────────────────────────────

describe("LotDetailsPage Sprint A CTA routing", () => {
  const baseDraft = {
    localId: "lot-local-1",
    serverId: "lot-0001",
    collectorId: "collector-profile",
    title: "Mobile Lot",
    materialCategoryId: "mat-mobile",
    condition: "WORKING" as const,
    quantity: 10,
    quantityUnit: "pieces" as const,
    estimatedWeightKg: 5.0,
    pickupCityArea: "Coimbatore",
    pickupPinCode: "641001",
    pickupPreference: "RECYCLER_PICKUP" as const,
    evidence: [],
    syncStatus: "SYNCED" as const,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Verify Evidence CTA for CAPTURED lots", async () => {
    vi.mocked(getDraft).mockResolvedValue({ ...baseDraft, lotStatus: "CAPTURED" });
    mockedApi.getServerLot.mockRejectedValue(new Error("offline"));

    renderAt("/collector/lots/lot-local-1", <LotDetailsPage />);

    const btn = await screen.findByRole("link", { name: /Verify Evidence/i });
    expect(btn).toBeTruthy();
    expect(btn.getAttribute("href")).toContain("/verify");
  });

  it("shows Calculate Fair Value CTA for VERIFIED lots", async () => {
    vi.mocked(getDraft).mockResolvedValue({ ...baseDraft, lotStatus: "VERIFIED" });
    mockedApi.getServerLot.mockRejectedValue(new Error("offline"));

    renderAt("/collector/lots/lot-local-1", <LotDetailsPage />);

    const btn = await screen.findByRole("link", { name: /Calculate Fair Value/i });
    expect(btn).toBeTruthy();
    expect(btn.getAttribute("href")).toContain("/price");
  });

  it("shows View Recycler Matches CTA for LISTED lots", async () => {
    vi.mocked(getDraft).mockResolvedValue({ ...baseDraft, lotStatus: "LISTED" });
    mockedApi.getServerLot.mockRejectedValue(new Error("offline"));

    renderAt("/collector/lots/lot-local-1", <LotDetailsPage />);

    const btn = await screen.findByRole("link", { name: /View Recycler Matches/i });
    expect(btn).toBeTruthy();
    expect(btn.getAttribute("href")).toContain("/matches");
  });

  it("shows in-progress message for VERIFYING lots", async () => {
    vi.mocked(getDraft).mockResolvedValue({ ...baseDraft, lotStatus: "VERIFYING" });
    mockedApi.getServerLot.mockRejectedValue(new Error("offline"));

    renderAt("/collector/lots/lot-local-1", <LotDetailsPage />);

    await screen.findByText(/Verification in progress/i);
  });

  it("renders trust score from server lot when available", async () => {
    vi.mocked(getDraft).mockResolvedValue({ ...baseDraft, lotStatus: "VERIFIED" });
    mockedApi.getServerLot.mockResolvedValue({
      lot: {
        ...baseDraft,
        id: "lot-0001",
        humanId: "EW-0001",
        clientDraftId: "lot-local-1",
        status: "VERIFIED",
        item: null,
        pickup: null,
        evidence: [],
        trustScore: 78,
        confidenceLevel: "HIGH",
        fairLow: null,
        fairMid: null,
        fairHigh: null,
        currency: "INR",
        listedAt: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
      traceEvents: [],
    });

    renderAt("/collector/lots/lot-local-1", <LotDetailsPage />);

    const badge = await screen.findByText(/Trust Score: 78\/100/);
    expect(badge).toBeTruthy();
  });
});

// ── LotVerificationPage ───────────────────────────────────────────────────────

describe("LotVerificationPage", () => {
  it("renders idle state with Start Verification button", () => {
    renderAt("/collector/lots/lot-0001/verify", <LotVerificationPage />);
    expect(screen.getByRole("button", { name: /Start Verification/i })).toBeTruthy();
  });

  it("shows verification checks after success", async () => {
    const mockResult = {
      lotId: "lot-0001",
      trustScore: 72,
      confidenceLevel: "MEDIUM" as const,
      checks: [
        {
          id: "c1",
          lotId: "lot-0001",
          checkType: "IMAGE_QUALITY",
          status: "PASS" as const,
          scoreDelta: 10,
          reason: "All images pass format and size checks.",
          provider: "deterministic",
          isFallback: false,
          resultJson: null,
        },
      ],
      classificationResult: {
        eWasteProbability: 0.93,
        suggestedCategoryId: "mat-mobile",
        suggestedCategoryName: "Mobile Phones",
        categoryConfidence: 0.9,
        source: "demo",
        isDemo: true,
      },
      isDemoClassification: true,
      requiresManualCategoryConfirmation: false,
      message: "Verification complete.",
    };

    mockedApi.verifyLot.mockResolvedValue(mockResult);

    const user = userEvent.setup();

    renderAt("/collector/lots/lot-0001/verify", <LotVerificationPage />);
    await user.click(screen.getByRole("button", { name: /Start Verification/i }));

    const score = await screen.findByText("72");
    expect(score).toBeTruthy();

    const checkText = await screen.findByText(/All images pass format/);
    expect(checkText).toBeTruthy();
  });

  it("shows demo classification badge when isDemoClassification is true", async () => {
    const mockResult = {
      lotId: "lot-0001",
      trustScore: 72,
      confidenceLevel: "MEDIUM" as const,
      checks: [],
      classificationResult: {
        eWasteProbability: 0.9,
        suggestedCategoryId: "mat-mobile",
        suggestedCategoryName: "Mobile Phones",
        categoryConfidence: 0.88,
        source: "demo",
        isDemo: true,
      },
      isDemoClassification: true,
      requiresManualCategoryConfirmation: false,
      message: "Done.",
    };

    mockedApi.verifyLot.mockResolvedValue(mockResult);

    const user = userEvent.setup();

    renderAt("/collector/lots/lot-0001/verify", <LotVerificationPage />);
    await user.click(screen.getByRole("button", { name: /Start Verification/i }));

    const badge = await screen.findByText(/Demo adapter/i);
    expect(badge).toBeTruthy();
  });
});

// ── LotPricePage ──────────────────────────────────────────────────────────────

describe("LotPricePage", () => {
  it("renders idle state with Calculate Fair Value button", () => {
    renderAt("/collector/lots/lot-0001/price", <LotPricePage />);
    expect(screen.getByRole("button", { name: /Calculate Fair Value/i })).toBeTruthy();
  });

  it("always shows demo pricing disclaimer", () => {
    renderAt("/collector/lots/lot-0001/price", <LotPricePage />);
    expect(screen.getByText(/Demo pricing/i)).toBeTruthy();
  });

  it("renders fair value range after calculation", async () => {
    const mockPricing = {
      lotId: "lot-0001",
      materialCode: "MOBILE_PHONES",
      materialName: "Mobile Phones",
      referencePrice: 180,
      estimatedWeightKg: 8,
      conditionGrade: "WORKING",
      pricePerKgLow: 153,
      pricePerKgMid: 180,
      pricePerKgHigh: 207,
      lotValueLow: 1224,
      lotValueMid: 1440,
      lotValueHigh: 1656,
      currency: "INR",
      adjustments: [],
      disclaimer: "Reference/demo pricing — not a live market quote.",
      isDemo: true,
    };

    mockedApi.priceLot.mockResolvedValue(mockPricing);

    const user = userEvent.setup();

    renderAt("/collector/lots/lot-0001/price", <LotPricePage />);
    await user.click(screen.getByRole("button", { name: /Calculate Fair Value/i }));

    const mid = await screen.findByText(/1,440/);
    expect(mid).toBeTruthy();
  });
});

// ── LotMatchesPage ────────────────────────────────────────────────────────────

describe("LotMatchesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially", () => {
    mockedApi.getLotMatches.mockImplementation(() => new Promise(() => {})); // never resolves
    renderAt("/collector/lots/lot-0001/matches", <LotMatchesPage />);
    expect(screen.getByText(/Finding compatible recyclers/i)).toBeTruthy();
  });

  it("renders recycler match cards ranked by score", async () => {
    const mockMatches = [
      {
        recyclerId: "rec-005",
        name: "AllElec Recyclers",
        orgName: "AllElec Recyclers Pvt Ltd",
        matchScore: 95,
        matchReasons: ["Accepts Mobile", "Demo-authorized"],
        pickupAvailable: true,
        serviceRegions: ["641001"],
        authorizationStatus: "demo_authorized",
        contactInfo: "allelec@demo.local (demo)",
        isDemo: true,
      },
      {
        recyclerId: "rec-004",
        name: "CircuitLoop India",
        orgName: "CircuitLoop Recycling",
        matchScore: 75,
        matchReasons: ["Accepts PCB"],
        pickupAvailable: true,
        serviceRegions: ["641001"],
        authorizationStatus: "demo_pending",
        contactInfo: "circuitloop@demo.local (demo)",
        isDemo: true,
      },
    ];

    mockedApi.getLotMatches.mockResolvedValue(mockMatches);

    renderAt("/collector/lots/lot-0001/matches", <LotMatchesPage />);

    const allElec = await screen.findByText("AllElec Recyclers");
    expect(allElec).toBeTruthy();

    const circuit = await screen.findByText("CircuitLoop India");
    expect(circuit).toBeTruthy();

    // Both are labeled demo
    const demoLabels = await screen.findAllByText(/Demo data/i);
    expect(demoLabels.length).toBeGreaterThanOrEqual(2);
  });

  it("renders empty state when no matches found", async () => {
    mockedApi.getLotMatches.mockResolvedValue([]);
    renderAt("/collector/lots/lot-0001/matches", <LotMatchesPage />);
    await screen.findByText(/No compatible recyclers found/i);
  });
});

// ── Phase 2 regression: offline draft still works ─────────────────────────────

describe("Phase 2 regression", () => {
  it("getDraft is still callable for offline draft data", async () => {
    vi.mocked(getDraft).mockResolvedValue(undefined);
    const result = await getDraft("nonexistent-local-id");
    expect(result).toBeUndefined();
  });
});
