/**
 * Sprint B Frontend Tests
 *
 * Covers:
 * - Recycler marketplace rendering and tab navigation
 * - Recycler lot review and make offer form
 * - Live price fairness preview and low-price warning
 * - Collector offers page with comparison cards and fairness indicators
 * - Collector offer acceptance workflow
 * - Transaction page with agreed terms, declared weight snapshot
 * - Handover scheduling and QR code / manual fallback display
 * - Recycler receipt and physical weight verification UI
 * - 360px mobile responsive checks
 * - LotDetailsPage Sprint B status transitions & CTAs
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as apiClient from "../api/client";
import { RecyclerMarketplacePage } from "../pages/RecyclerMarketplacePage";
import { RecyclerLotReviewPage } from "../pages/RecyclerLotReviewPage";
import { CollectorOffersPage } from "../pages/CollectorOffersPage";
import { TransactionPage } from "../pages/TransactionPage";
import { LotDetailsPage } from "../pages/LotDetailsPage";
import { getDraft } from "../offline/draftRepository";
import type {
  ServerLot,
  OfferRecord,
  TransactionRecord,
  MarketplaceLotSummary,
  PricingResult,
} from "../collector/lot-types";

// Mock auth context
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    token: "demo-token-recycler",
    user: { id: "rec-bangalore-demo", role: "RECYCLER", displayName: "Apex Bangalore" },
    status: "authenticated",
  }),
}));

// Mock offline repository
vi.mock("../offline/draftRepository", () => ({
  getDraft: vi.fn(),
  saveDraft: vi.fn(),
  saveEvidence: vi.fn(),
  pendingMutations: vi.fn(() => Promise.resolve([])),
  markCaptured: vi.fn(),
}));

// Mock API Client
vi.mock("../api/client", async (importOriginal) => {
  const real = await importOriginal<typeof apiClient>();
  return {
    ...real,
    getMarketplaceLots: vi.fn(),
    getRecyclerOffers: vi.fn(),
    getRecyclerTransactions: vi.fn(),
    getMaterials: vi.fn(() => Promise.resolve([])),
    fetchLotById: vi.fn(),
    fetchPriceEstimate: vi.fn(),
    fetchRecyclerMatches: vi.fn(),
    fetchOffersByLot: vi.fn(),
    createOffer: vi.fn(),
    acceptOffer: vi.fn(),
    checkPriceFairness: vi.fn(),
    fetchTransactionByLot: vi.fn(),
    fetchTransactionById: vi.fn(),
    fetchHandoverQR: vi.fn(),
    scheduleHandover: vi.fn(),
    validateHandoverToken: vi.fn(),
    confirmPickup: vi.fn(),
    confirmReceipt: vi.fn(),
    verifyWeight: vi.fn(),
    getServerLot: vi.fn(),
  };
});

const mockedApi = vi.mocked(apiClient);

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function renderWithClient(ui: React.ReactElement, initialPath = "/") {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function makeServerLot(overrides: Partial<ServerLot> = {}): ServerLot {
  return {
    id: "lot-pcb-1",
    humanId: "EW-2026-0001",
    collectorId: "col-1",
    clientDraftId: "draft-pcb-1",
    title: "PCB Scrap Lot",
    status: "LISTED",
    item: {
      materialCategoryId: "CIRCUIT_BOARDS",
      condition: "SCRAP",
      quantity: 5,
      quantityUnit: "kg",
      estimatedWeightKg: 10,
    },
    pickup: {
      cityArea: "Bangalore",
      pinCode: "560001",
      preference: "RECYCLER_PICKUP",
    },
    evidence: [],
    trustScore: 88,
    confidenceLevel: "HIGH",
    fairLow: 400,
    fairMid: 480,
    fairHigh: 560,
    currency: "INR",
    listedAt: "2026-01-01T00:00:00Z",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    category: "CIRCUIT_BOARDS",
    condition: "SCRAP",
    declared_item_count: 5,
    approximate_weight_kg: 10,
    verification_confidence: 0.88,
    pickup_address: { city: "Bangalore", postal_code: "560001" },
    photos: [],
    ...overrides,
  };
}

function makePricingResult(overrides: Partial<PricingResult> = {}): PricingResult {
  return {
    lotId: "lot-pcb-1",
    materialCode: "CIRCUIT_BOARDS",
    materialName: "Circuit Boards",
    referencePrice: 480,
    conditionGrade: "SCRAP",
    estimatedWeightKg: 10,
    pricePerKgLow: 400,
    pricePerKgMid: 480,
    pricePerKgHigh: 560,
    lotValueLow: 4000,
    lotValueMid: 4800,
    lotValueHigh: 5600,
    currency: "INR",
    adjustments: [],
    disclaimer: "Demo reference prices only",
    isDemo: true,
    fair_range: { low_per_kg: 400, mid_per_kg: 480, high_per_kg: 560 },
    estimated_total_fair_value: 4800,
    ...overrides,
  };
}

function makeOffer(overrides: Partial<OfferRecord> = {}): OfferRecord {
  return {
    id: "offer-fair",
    lotId: "lot-col-1",
    lot_id: "lot-col-1",
    recyclerId: "rec-bangalore-demo",
    recycler_id: "rec-bangalore-demo",
    pricePerKg: 480,
    price_per_kg: 480,
    estimatedTotal: 960,
    estimated_total: 960,
    pickupOption: "RECYCLER_PICKUP",
    pickup_option: "RECYCLER_PICKUP",
    status: "PENDING",
    fairness_classification: "NORMAL",
    fairness_deviation: 0.0,
    fairness_explanation: "Within expected reference range for this material.",
    createdAt: new Date().toISOString(),
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeTransaction(overrides: Partial<TransactionRecord> = {}): TransactionRecord {
  return {
    id: "tx-123",
    lotId: "lot-col-1",
    lot_id: "lot-col-1",
    collectorId: "collector-1",
    collector_id: "collector-1",
    recyclerId: "rec-bangalore-demo",
    recycler_id: "rec-bangalore-demo",
    agreedPricePerKg: 480,
    agreed_price_per_kg: 480,
    declaredWeightSnapshot: 10,
    declared_weight_snapshot: 10,
    provisionalEstimatedTotal: 4800,
    provisional_amount: 4800,
    status: "HANDOVER_SCHEDULED",
    scheduled_date: "2026-09-12",
    time_window: "10:00 AM - 01:00 PM",
    ...overrides,
  };
}

describe("Sprint B Frontend Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Recycler Marketplace ────────────────────────────────────────────────
  describe("Recycler Marketplace", () => {
    const mockLots: MarketplaceLotSummary[] = [
      {
        id: "lot-pcb-1",
        humanId: "EW-PCB-01",
        title: "PCB Scrap Lot",
        materialCategoryId: "CIRCUIT_BOARDS",
        condition: "SCRAP",
        status: "LISTED",
        estimatedWeightKg: 10,
        cityArea: "Bangalore",
        pinCode: "560001",
        trustScore: 85,
        confidenceLevel: "HIGH",
        fairMid: 480,
        currency: "INR",
        evidenceCount: 3,
        isDemo: true,
        matchScore: 95,
      },
    ];

    it("renders available lots tab with compatibility and trust score", async () => {
      mockedApi.getMarketplaceLots.mockResolvedValue(mockLots);
      mockedApi.getRecyclerOffers.mockResolvedValue([]);
      mockedApi.getRecyclerTransactions.mockResolvedValue([]);

      renderWithClient(<RecyclerMarketplacePage />);

      expect(await screen.findByRole("heading", { name: /Recycler dashboard/i })).toBeTruthy();
      expect(screen.getByRole("button", { name: /Available Lots/i })).toBeTruthy();
      expect(await screen.findByText("PCB Scrap Lot")).toBeTruthy();
      expect(screen.getByText("Bangalore")).toBeTruthy();
      expect(screen.getByText("95%")).toBeTruthy();
      expect(screen.getByText(/Review & Make Offer/i)).toBeTruthy();
    });

    it("switches tabs between available lots, my offers, and handovers", async () => {
      mockedApi.getMarketplaceLots.mockResolvedValue([]);
      mockedApi.getRecyclerOffers.mockResolvedValue([]);
      mockedApi.getRecyclerTransactions.mockResolvedValue([]);

      renderWithClient(<RecyclerMarketplacePage />);

      const offersTab = screen.getByRole("button", { name: /My Offers/i });
      fireEvent.click(offersTab);

      expect(await screen.findByText("No offers submitted yet")).toBeTruthy();

      const handoversTab = screen.getByRole("button", { name: /Handovers/i });
      fireEvent.click(handoversTab);

      expect(await screen.findByText("No scheduled handovers")).toBeTruthy();
    });
  });

  // ── 2. Recycler Lot Review & Offer Form ────────────────────────────────────
  describe("Recycler Lot Review & Offer Form", () => {
    const mockLot = makeServerLot({
      id: "lot-pcb-1",
      category: "CIRCUIT_BOARDS",
      condition: "SCRAP",
      status: "LISTED",
      declared_item_count: 5,
      approximate_weight_kg: 10,
      verification_confidence: 0.88,
    });

    it("displays lot specs, trust score, and fair benchmark", async () => {
      mockedApi.fetchLotById.mockResolvedValue({ lot: mockLot, traceEvents: [] });
      mockedApi.fetchPriceEstimate.mockResolvedValue(makePricingResult());
      mockedApi.fetchRecyclerMatches.mockResolvedValue({ matches: [] });

      renderWithClient(
        <Routes>
          <Route path="/recycler/lots/:lotId" element={<RecyclerLotReviewPage />} />
        </Routes>,
        "/recycler/lots/lot-pcb-1"
      );

      expect(await screen.findByText("lot-pcb-1")).toBeTruthy();
      expect(screen.getAllByText("CIRCUIT_BOARDS").length).toBeGreaterThan(0);
      expect(screen.getByText("88%")).toBeTruthy();
      expect(screen.getByText("₹400 - ₹560")).toBeTruthy();
      expect(screen.getByText("Make an Offer")).toBeTruthy();
    });

    it("previews live fairness classification and warning for abnormal offer", async () => {
      mockedApi.fetchLotById.mockResolvedValue({ lot: mockLot, traceEvents: [] });
      mockedApi.fetchPriceEstimate.mockResolvedValue(makePricingResult());
      mockedApi.fetchRecyclerMatches.mockResolvedValue({ matches: [] });
      mockedApi.checkPriceFairness.mockResolvedValue({
        classification: "VERY_LOW",
        percentage_deviation: -47.9,
        human_explanation: "Unusually low compared with the demo/reference fair-value range.",
        fair_range: { low_per_kg: 400, mid_per_kg: 480, high_per_kg: 560 },
      });

      renderWithClient(
        <Routes>
          <Route path="/recycler/lots/:lotId" element={<RecyclerLotReviewPage />} />
        </Routes>,
        "/recycler/lots/lot-pcb-1"
      );

      const input = (await screen.findByPlaceholderText("e.g. 480")) as HTMLInputElement;
      fireEvent.change(input, { target: { value: "250" } });

      expect(await screen.findByText("Fairness Classification: VERY_LOW")).toBeTruthy();
      expect(screen.getByText(/Unusually low compared with the demo\/reference/i)).toBeTruthy();
      expect(screen.getByText(/Deviation from midpoint: -47.9%/i)).toBeTruthy();
    });
  });

  // ── 3. Collector Offers Page & Acceptance ──────────────────────────────────
  describe("Collector Offers Page", () => {
    const mockLot = makeServerLot({
      id: "lot-col-1",
      category: "MOBILE_PHONES",
      condition: "PARTIALLY_WORKING",
      status: "OFFERS_RECEIVED",
      declared_item_count: 4,
      approximate_weight_kg: 2,
    });

    const mockOffers: OfferRecord[] = [
      makeOffer({
        id: "offer-fair",
        lot_id: "lot-col-1",
        recycler_id: "rec-bangalore-demo",
        price_per_kg: 480,
        estimated_total: 960,
        pickup_option: "RECYCLER_PICKUP",
        status: "PENDING",
        fairness_classification: "NORMAL",
        fairness_deviation: 0.0,
        fairness_explanation: "Within expected reference range for this material.",
      }),
      makeOffer({
        id: "offer-low",
        lot_id: "lot-col-1",
        recycler_id: "rec-chennai-demo",
        price_per_kg: 250,
        estimated_total: 500,
        pickup_option: "RECYCLER_PICKUP",
        status: "PENDING",
        fairness_classification: "VERY_LOW",
        fairness_deviation: -47.9,
        fairness_explanation: "Unusually low compared with the demo/reference fair-value range.",
      }),
    ];

    it("displays both normal and low offers with distinct fairness warnings", async () => {
      mockedApi.fetchLotById.mockResolvedValue({ lot: mockLot, traceEvents: [] });
      mockedApi.fetchOffersByLot.mockResolvedValue({ offers: mockOffers });

      renderWithClient(
        <Routes>
          <Route path="/collector/lots/:lotId/offers" element={<CollectorOffersPage />} />
        </Routes>,
        "/collector/lots/lot-col-1/offers"
      );

      expect(await screen.findByText("Commercial Offers")).toBeTruthy();
      expect(screen.getByText("Fairness: NORMAL")).toBeTruthy();
      expect(screen.getByText("Fairness: VERY_LOW")).toBeTruthy();
      expect(screen.getByText("Within expected reference range for this material.")).toBeTruthy();
      expect(screen.getByText("Unusually low compared with the demo/reference fair-value range.")).toBeTruthy();
    });

    it("allows collector to accept an offer", async () => {
      mockedApi.fetchLotById.mockResolvedValue({ lot: mockLot, traceEvents: [] });
      mockedApi.fetchOffersByLot.mockResolvedValue({ offers: mockOffers });
      mockedApi.acceptOffer.mockResolvedValue({
        transaction: makeTransaction({
          id: "tx-demo-1",
          lot_id: "lot-col-1",
          status: "OFFER_ACCEPTED",
        }),
        lot: mockLot,
        message: "Offer accepted",
      });

      renderWithClient(
        <Routes>
          <Route path="/collector/lots/:lotId/offers" element={<CollectorOffersPage />} />
          <Route path="/collector/lots/:lotId/transaction" element={<div>Transaction View Page</div>} />
        </Routes>,
        "/collector/lots/lot-col-1/offers"
      );

      const acceptButtons = await screen.findAllByRole("button", { name: /Accept Offer/i });
      fireEvent.click(acceptButtons[0]);

      await waitFor(() => {
        expect(mockedApi.acceptOffer).toHaveBeenCalledWith("offer-fair");
      });
    });
  });

  // ── 4. Transaction Page, QR & Weight Verification ──────────────────────────
  describe("Transaction Page & Handover", () => {
    const mockTransaction = makeTransaction();

    const mockLot = makeServerLot({
      id: "lot-col-1",
      status: "HANDOVER_SCHEDULED",
    });

    it("displays transaction summary, QR code, and manual fallback code", async () => {
      mockedApi.fetchTransactionById.mockResolvedValue(mockTransaction);
      mockedApi.fetchLotById.mockResolvedValue({
        lot: mockLot,
        traceEvents: [
          { event_type: "OFFER_ACCEPTED", notes: "Offer accepted", timestamp: new Date().toISOString() },
          { event_type: "HANDOVER_SCHEDULED", notes: "Handover scheduled", timestamp: new Date().toISOString() },
        ],
      });
      mockedApi.fetchHandoverQR.mockResolvedValue({
        transactionId: "tx-123",
        lotId: "lot-col-1",
        qrToken: "opaque-token-abc",
        manualCode: "HO-9942",
        scheduledAt: "2026-09-12",
        pickupAddress: "Bangalore",
        pickupWindow: "10:00 AM - 01:00 PM",
        status: "ACTIVE",
        isDemo: true,
      });

      renderWithClient(
        <Routes>
          <Route path="/transactions/:transactionId" element={<TransactionPage />} />
        </Routes>,
        "/transactions/tx-123"
      );

      expect(await screen.findByText("Transaction tx-123")).toBeTruthy();
      expect(screen.getByText("₹480 / kg")).toBeTruthy();
      expect(screen.getByText("10 kg")).toBeTruthy();
      expect(await screen.findByText("HO-9942")).toBeTruthy();
      expect(screen.getByText("Opaque Token Authenticated")).toBeTruthy();
      expect(screen.getByText("Traceability Timeline")).toBeTruthy();
    });

    it("displays physical verified weight comparison and 'Ready for payment' when WEIGHT_VERIFIED", async () => {
      const verifiedTx = makeTransaction({
        status: "WEIGHT_VERIFIED",
        verified_weight_kg: 9.8,
        weight_difference_kg: -0.2,
        weight_difference_percent: -2.0,
        final_amount: 4704,
      });

      mockedApi.fetchTransactionById.mockResolvedValue(verifiedTx);
      mockedApi.fetchLotById.mockResolvedValue({
        lot: makeServerLot({ id: "lot-col-1", status: "WEIGHT_VERIFIED" }),
        traceEvents: [],
      });
      mockedApi.fetchHandoverQR.mockResolvedValue({
        transactionId: "tx-123",
        lotId: "lot-col-1",
        qrToken: "opaque-token-abc",
        manualCode: "HO-9942",
        scheduledAt: "2026-09-12",
        pickupAddress: "Bangalore",
        pickupWindow: "10:00 AM - 01:00 PM",
        status: "CONSUMED",
        isDemo: true,
      });

      renderWithClient(
        <Routes>
          <Route path="/transactions/:transactionId" element={<TransactionPage />} />
        </Routes>,
        "/transactions/tx-123"
      );

      expect(await screen.findByText("Verified Physical Scale Settlement")).toBeTruthy();
      expect(screen.getByText("9.8 kg")).toBeTruthy();
      expect(screen.getByText("-0.20 kg (-2.0%)")).toBeTruthy();
      expect((await screen.findAllByText(/4,704/)).length).toBeGreaterThan(0);
      expect(screen.getByText("Ready for payment")).toBeTruthy();
    });
  });

  // ── 5. Mobile Responsiveness (360px) ──────────────────────────────────────
  describe("Mobile 360px viewport checks", () => {
    it("renders collector offers page at 360px viewport without crashing", async () => {
      window.innerWidth = 360;
      window.innerHeight = 640;
      window.dispatchEvent(new Event("resize"));

      mockedApi.fetchLotById.mockResolvedValue({
        lot: makeServerLot({ id: "lot-360", category: "MOBILE_PHONES", status: "OFFERS_RECEIVED" }),
        traceEvents: [],
      });
      mockedApi.fetchOffersByLot.mockResolvedValue({ offers: [] });

      renderWithClient(
        <Routes>
          <Route path="/collector/lots/:lotId/offers" element={<CollectorOffersPage />} />
        </Routes>,
        "/collector/lots/lot-360/offers"
      );

      expect(await screen.findByText("Commercial Offers")).toBeTruthy();
    });
  });

  // ── 6. LotDetailsPage Status Routing ──────────────────────────────────────
  describe("LotDetailsPage Sprint B State Transitions", () => {
    it("shows Review & Compare Offers CTA when lot is OFFERS_RECEIVED", async () => {
      vi.mocked(getDraft).mockResolvedValue({
        localId: "lot-draft-1",
        serverId: "lot-001",
        collectorId: "col-1",
        title: "Mobile Phones Lot",
        lotStatus: "OFFERS_RECEIVED",
        materialCategoryId: "MOBILE_PHONES",
        condition: "PARTIALLY_WORKING",
        quantity: 1,
        quantityUnit: "pieces",
        estimatedWeightKg: 1,
        pickupCityArea: "Bangalore",
        pickupPinCode: "560001",
        pickupPreference: "RECYCLER_PICKUP",
        evidence: [],
        syncStatus: "SYNCED",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });

      mockedApi.getServerLot.mockRejectedValue(new Error("offline"));

      renderWithClient(
        <Routes>
          <Route path="/collector/lots/:lotId" element={<LotDetailsPage />} />
        </Routes>,
        "/collector/lots/lot-draft-1"
      );

      const btn = await screen.findByRole("link", { name: /Review & Compare Offers/i });
      expect(btn).toBeTruthy();
      expect(btn.getAttribute("href")).toContain("/offers");
    });

    it("shows View Transaction & Handover CTA when lot is OFFER_ACCEPTED", async () => {
      vi.mocked(getDraft).mockResolvedValue({
        localId: "lot-draft-2",
        serverId: "lot-002",
        collectorId: "col-1",
        title: "Mobile Phones Lot",
        lotStatus: "OFFER_ACCEPTED",
        materialCategoryId: "MOBILE_PHONES",
        condition: "PARTIALLY_WORKING",
        quantity: 1,
        quantityUnit: "pieces",
        estimatedWeightKg: 1,
        pickupCityArea: "Bangalore",
        pickupPinCode: "560001",
        pickupPreference: "RECYCLER_PICKUP",
        evidence: [],
        syncStatus: "SYNCED",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });

      mockedApi.getServerLot.mockRejectedValue(new Error("offline"));

      renderWithClient(
        <Routes>
          <Route path="/collector/lots/:lotId" element={<LotDetailsPage />} />
        </Routes>,
        "/collector/lots/lot-draft-2"
      );

      const btn = await screen.findByRole("link", { name: /View Transaction & Handover/i });
      expect(btn).toBeTruthy();
      expect(btn.getAttribute("href")).toContain("/transaction");
    });
  });
});
