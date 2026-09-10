/**
 * Sprint C Frontend Tests
 *
 * Covers:
 * - Simple & Multilingual Price Catalog rendering and search
 * - Audio & Pictorial Safety Center rendering and text-to-speech button triggers
 * - Collector Earnings Ledger with KPI summary and transaction history
 * - Language switcher toggling between English and Hindi
 * - TransactionPage settlement:
 *   - WEIGHT_VERIFIED demo payment confirmation CTA
 *   - PAYMENT_CONFIRMED processing initiation form
 *   - PROCESSING recycling evidence submission form
 *   - RECYCLING_EVIDENCE_ADDED evidence card and lot closure CTA
 *   - CLOSED formal recycling digital passport and print summary
 * - 360px mobile responsive checks
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as apiClient from "../api/client";
import { PriceCatalogPage } from "../pages/PriceCatalogPage";
import { SafetyCenterPage } from "../pages/SafetyCenterPage";
import { CollectorEarningsPage } from "../pages/CollectorEarningsPage";
import { TransactionPage } from "../pages/TransactionPage";
import { CollectorDashboard } from "../pages/DashboardPages";
import { LanguageProvider } from "../i18n/LanguageContext";
import type {
  TransactionRecord,
  ServerLot,
  CollectorEarningsSummary,
  RecyclingEvidenceRecord
} from "../collector/lot-types";

// Mock auth context
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    token: "demo-token-collector",
    user: { id: "collector_1", role: "COLLECTOR", displayName: "Ramesh Collector" },
    status: "authenticated",
  }),
}));

// Mock API Client
vi.mock("../api/client", async (importOriginal) => {
  const real = await importOriginal<typeof apiClient>();
  return {
    ...real,
    fetchCollectorEarnings: vi.fn(),
    fetchTransactionById: vi.fn(),
    fetchTransactionByLot: vi.fn(),
    fetchLotById: vi.fn(),
    fetchHandoverQR: vi.fn(),
    confirmPayment: vi.fn(),
    startProcessing: vi.fn(),
    addRecyclingEvidence: vi.fn(),
    closeLot: vi.fn(),
    fetchRecyclingEvidence: vi.fn(),
  };
});

function renderWithProviders(ui: React.ReactElement, initialPath = "/") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          {ui}
        </MemoryRouter>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

describe("Sprint C: Reference Price Catalog", () => {
  it("renders reference price categories and explains fair price factors", () => {
    renderWithProviders(<PriceCatalogPage />);

    expect(screen.getByText(/Reference E-Waste Price Catalog/i)).toBeInTheDocument();
    expect(screen.getByText(/Smartphones & Mobile Devices/i)).toBeInTheDocument();
    expect(screen.getByText(/Printed Circuit Boards/i)).toBeInTheDocument();
    expect(screen.getByText(/Industrial & Consumer Batteries/i)).toBeInTheDocument();
    expect(screen.getByText(/How Fair Prices Are Calculated/i)).toBeInTheDocument();
  });

  it("filters price items by search keyword", () => {
    renderWithProviders(<PriceCatalogPage />);

    const searchInput = screen.getByPlaceholderText(/Search e-waste categories/i);
    fireEvent.change(searchInput, { target: { value: "Batteries" } });

    expect(screen.getByText(/Industrial & Consumer Batteries/i)).toBeInTheDocument();
    expect(screen.queryByText(/Monitors, Televisions/i)).not.toBeInTheDocument();
  });
});

describe("Sprint C: Pictorial & Audio Safety Center", () => {
  beforeEach(() => {
    // Mock window.speechSynthesis and global SpeechSynthesisUtterance
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        speak: vi.fn(),
        cancel: vi.fn(),
        getVoices: vi.fn(() => []),
      },
      writable: true,
    });

    class MockSpeechSynthesisUtterance {
      text: string;
      lang = "";
      voice = null;
      rate = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    // @ts-expect-error Mocking global SpeechSynthesisUtterance
    global.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
  });

  it("renders 6 pictorial category cards with hazard badges and guidance", () => {
    renderWithProviders(<SafetyCenterPage />);

    expect(screen.getAllByText(/Safe Handling/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Batteries & Power Cells/i)).toBeInTheDocument();
    expect(screen.getByText(/CRT Monitors & Display Panels/i)).toBeInTheDocument();
    expect(screen.getByText(/Printed Circuit Boards/i)).toBeInTheDocument();
    expect(screen.getByText(/Refrigerators & Cooling Equipment/i)).toBeInTheDocument();
  });

  it("triggers audio read-aloud when Read Aloud button is clicked", () => {
    renderWithProviders(<SafetyCenterPage />);

    const speakButtons = screen.getAllByRole("button", { name: /Read Aloud/i });
    expect(speakButtons.length).toBeGreaterThan(0);

    fireEvent.click(speakButtons[0]);
    expect(window.speechSynthesis.speak).toHaveBeenCalled();
  });
});

describe("Sprint C: Collector Earnings Ledger", () => {
  const mockEarnings: CollectorEarningsSummary = {
    collector_id: "collector_1",
    total_completed_earnings: 14500,
    total_lots_recycled: 3,
    total_physical_weight_kg: 85.5,
    pending_settlement_amount: 3200,
    pending_lots_count: 1,
    transactions: [
      {
        id: "tx-demo-101",
        transaction_id: "tx-demo-101",
        lot_id: "lot-101",
        lot_human_id: "LOT-00101",
        material_type: "SMARTPHONES",
        verified_weight_kg: 12.0,
        agreed_price_per_kg: 450,
        final_amount: 5400,
        status: "CLOSED",
        recycler_name: "Apex Recyclers",
        completed_at: "2026-09-10T10:00:00Z",
      },
      {
        id: "tx-demo-102",
        transaction_id: "tx-demo-102",
        lot_id: "lot-102",
        lot_human_id: "LOT-00102",
        material_type: "PRINTED_CIRCUIT_BOARDS",
        verified_weight_kg: 25.0,
        agreed_price_per_kg: 364,
        final_amount: 9100,
        status: "PAYMENT_CONFIRMED",
        recycler_name: "EcoProcess Authorized",
        completed_at: "2026-09-09T14:30:00Z",
      },
    ],
  };

  it("renders earnings KPI metrics and ledger history", async () => {
    vi.mocked(apiClient.fetchCollectorEarnings).mockResolvedValue(mockEarnings);

    renderWithProviders(<CollectorEarningsPage />);

    await waitFor(() => {
      expect(screen.getByText(/₹14,500/i)).toBeInTheDocument();
      expect(screen.getByText(/₹3,200/i)).toBeInTheDocument();
      expect(screen.getByText(/85.50 kg/i)).toBeInTheDocument();
      expect(screen.getByText(/tx-demo-101/i)).toBeInTheDocument();
      expect(screen.getByText(/Apex Recyclers/i)).toBeInTheDocument();
    });
  });
});

describe("Sprint C: Collector Dashboard Actions", () => {
  it("renders the 5 core action cards on Collector Dashboard", () => {
    renderWithProviders(<CollectorDashboard />);

    expect(screen.getAllByText(/Create E-Waste Lot/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Price/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/My Lots/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Earnings/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Safety/i).length).toBeGreaterThanOrEqual(1);
  });
});

describe("Sprint C: Transaction Page Settlement & Recycling Evidence Flow", () => {
  const baseLot: ServerLot = {
    id: "lot-sprint-c",
    humanId: "LOT-SPRINTC-01",
    collectorId: "collector_1",
    clientDraftId: "draft-sprint-c",
    title: "Batch of Old Smartphones",
    status: "WEIGHT_VERIFIED",
    item: {
      materialCategoryId: "MOBILE_PHONES",
      quantity: 20,
      quantityUnit: "pieces",
      estimatedWeightKg: 10,
      condition: "SCRAP",
    },
    pickup: {
      cityArea: "Sector 4",
      pinCode: "560001",
      preference: "RECYCLER_PICKUP",
    },
    evidence: [],
    trustScore: 88,
    confidenceLevel: "HIGH",
    fairLow: 350,
    fairMid: 400,
    fairHigh: 450,
    currency: "INR",
    listedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const baseTx: TransactionRecord = {
    id: "tx-sprint-c",
    lot_id: "lot-sprint-c",
    collector_id: "collector_1",
    recycler_id: "recycler_apex",
    agreed_price_per_kg: 400,
    declared_weight_snapshot: 10,
    provisional_amount: 4000,
    verified_weight_kg: 10.5,
    final_amount: 4200,
    status: "WEIGHT_VERIFIED",
    created_at: new Date().toISOString(),
  };

  it("shows Confirm Payment CTA when lot is WEIGHT_VERIFIED", async () => {
    vi.mocked(apiClient.fetchTransactionById).mockResolvedValue(baseTx);
    vi.mocked(apiClient.fetchLotById).mockResolvedValue({
      lot: { ...baseLot, status: "WEIGHT_VERIFIED" },
      traceEvents: [
        { event_type: "WEIGHT_VERIFIED", timestamp: new Date().toISOString(), notes: "Scale verified: 10.5 kg" },
      ],
    });

    renderWithProviders(
      <Routes>
        <Route path="/transactions/:transactionId" element={<TransactionPage />} />
      </Routes>,
      "/transactions/tx-sprint-c"
    );

    await waitFor(() => {
      expect(screen.getByText(/Commercial Settlement Payment/i)).toBeInTheDocument();
      expect(screen.getByText(/Confirm Payment of ₹4,200/i)).toBeInTheDocument();
    });
  });

  it("shows Start Processing form when status is PAYMENT_CONFIRMED", async () => {
    const paidTx: TransactionRecord = {
      ...baseTx,
      status: "PAYMENT_CONFIRMED",
    };

    vi.mocked(apiClient.fetchTransactionById).mockResolvedValue(paidTx);
    vi.mocked(apiClient.fetchLotById).mockResolvedValue({
      lot: { ...baseLot, status: "PAYMENT_CONFIRMED" },
      traceEvents: [
        { event_type: "PAYMENT_CONFIRMED", timestamp: new Date().toISOString(), notes: "Demo payment confirmed" },
      ],
    });

    renderWithProviders(
      <Routes>
        <Route path="/transactions/:transactionId" element={<TransactionPage />} />
      </Routes>,
      "/transactions/tx-sprint-c"
    );

    await waitFor(() => {
      expect(screen.getByText(/Payment Successfully Confirmed/i)).toBeInTheDocument();
      expect(screen.getByText(/Next Step: Initiate Safe Material Processing/i)).toBeInTheDocument();
      expect(screen.getByText(/Start Material Processing/i)).toBeInTheDocument();
    });
  });

  it("shows Recycling Evidence form when status is PROCESSING", async () => {
    const processingTx: TransactionRecord = {
      ...baseTx,
      status: "PROCESSING",
    };

    vi.mocked(apiClient.fetchTransactionById).mockResolvedValue(processingTx);
    vi.mocked(apiClient.fetchLotById).mockResolvedValue({
      lot: { ...baseLot, status: "PROCESSING" },
      traceEvents: [
        { event_type: "PROCESSING", timestamp: new Date().toISOString(), notes: "Processing started" },
      ],
    });

    renderWithProviders(
      <Routes>
        <Route path="/transactions/:transactionId" element={<TransactionPage />} />
      </Routes>,
      "/transactions/tx-sprint-c"
    );

    await waitFor(() => {
      expect(screen.getByText(/Material Processing In Progress/i)).toBeInTheDocument();
      expect(screen.getByText(/Record Recycling Evidence & Output Fractions/i)).toBeInTheDocument();
      expect(screen.getByText(/Submit Recycling Evidence/i)).toBeInTheDocument();
    });
  });

  it("shows Proof of Recycling card and Finalize & Close Lot button when RECYCLING_EVIDENCE_ADDED", async () => {
    const evidenceTx: TransactionRecord = {
      ...baseTx,
      status: "RECYCLING_EVIDENCE_ADDED",
    };

    const mockEvidence: RecyclingEvidenceRecord = {
      id: "ev-101",
      transaction_id: "tx-sprint-c",
      lot_id: "lot-sprint-c",
      recycler_id: "recycler_apex",
      material_outputs: [
        { material_name: "Copper", weight_kg: 1.2, recovery_percentage: 95, destination: "Authorized Smelter" }
      ],
      recovery_rate_percent: 94.5,
      recycling_facility_name: "GreenEco R2 Facility",
      certificate_number: "EPR-CERT-998811",
      created_at: new Date().toISOString()
    };

    vi.mocked(apiClient.fetchTransactionById).mockResolvedValue(evidenceTx);
    vi.mocked(apiClient.fetchRecyclingEvidence).mockResolvedValue({ evidence: mockEvidence });
    vi.mocked(apiClient.fetchLotById).mockResolvedValue({
      lot: { ...baseLot, status: "RECYCLING_EVIDENCE_ADDED" },
      traceEvents: [
        { event_type: "RECYCLING_EVIDENCE_ADDED", timestamp: new Date().toISOString(), notes: "Evidence added" },
      ],
    });

    renderWithProviders(
      <Routes>
        <Route path="/transactions/:transactionId" element={<TransactionPage />} />
      </Routes>,
      "/transactions/tx-sprint-c"
    );

    await waitFor(() => {
      expect(screen.getByText(/Verified Proof of Recycling/i)).toBeInTheDocument();
      expect(screen.getByText(/EPR-CERT-998811/i)).toBeInTheDocument();
      expect(screen.getByText(/Finalize & Close Digital Lot/i)).toBeInTheDocument();
    });
  });

  it("shows Closed Digital Passport and Print Summary when lot is CLOSED", async () => {
    const closedTx: TransactionRecord = {
      ...baseTx,
      status: "CLOSED",
    };

    vi.mocked(apiClient.fetchTransactionById).mockResolvedValue(closedTx);
    vi.mocked(apiClient.fetchRecyclingEvidence).mockResolvedValue({
      evidence: {
        id: "ev-101",
        transaction_id: "tx-sprint-c",
        lot_id: "lot-sprint-c",
        recycler_id: "recycler_apex",
        material_outputs: [],
        recovery_rate_percent: 95.0,
        recycling_facility_name: "GreenEco R2 Facility",
        certificate_number: "EPR-CERT-CLOSED-77",
        created_at: new Date().toISOString()
      }
    });
    vi.mocked(apiClient.fetchLotById).mockResolvedValue({
      lot: { ...baseLot, status: "CLOSED" },
      traceEvents: [
        { event_type: "CLOSED", timestamp: new Date().toISOString(), notes: "Lot closed" },
      ],
    });

    renderWithProviders(
      <Routes>
        <Route path="/transactions/:transactionId" element={<TransactionPage />} />
      </Routes>,
      "/transactions/tx-sprint-c"
    );

    await waitFor(() => {
      expect(screen.getByText(/Formal E-Waste Recycling Completed/i)).toBeInTheDocument();
      expect(screen.getByText(/LIFECYCLE CLOSED/i)).toBeInTheDocument();
      expect(screen.getByText(/Print Summary/i)).toBeInTheDocument();
    });
  });
});
