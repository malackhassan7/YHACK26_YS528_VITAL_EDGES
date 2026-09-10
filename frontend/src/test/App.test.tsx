import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";

const users = {
  "demo-token-collector": { id: "collector-profile", email: "collector@demo.local", displayName: "Meena Collector", role: "COLLECTOR", isDemo: true },
  "demo-token-recycler": { id: "recycler-profile", email: "recycler@demo.local", displayName: "GreenLoop Recycler", role: "RECYCLER", isDemo: true },
  "demo-token-admin": { id: "admin-profile", email: "admin@demo.local", displayName: "Asha Admin", role: "ADMIN", isDemo: true },
} as const;

function mockFetch() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/health")) {
      return new Response(JSON.stringify({ status: "ok", service: "vital-edges-api", authMode: "demo" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.endsWith("/auth/me")) {
      const auth = init?.headers instanceof Headers ? init.headers.get("Authorization") : (init?.headers as Record<string, string> | undefined)?.Authorization;
      const token = auth?.replace("Bearer ", "") as keyof typeof users | undefined;
      const user = token ? users[token] : undefined;
      if (!user) {
        return new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Missing or invalid token." } }), { status: 401, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(user), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "Not found." } }), { status: 404, headers: { "Content-Type": "application/json" } });
  });
}

async function renderAt(route: string) {
  render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.queryByText("Checking backend...")).not.toBeInTheDocument());
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", mockFetch());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Phase 1 app shell", () => {
  it("renders the application landing page", async () => {
    await renderAt("/");
    expect(screen.getByRole("heading", { name: "Vital Edges" })).toBeInTheDocument();
    expect(screen.getByText("Backend online")).toBeInTheDocument();
  });

  it("collector role reaches collector dashboard", async () => {
    const user = userEvent.setup();
    await renderAt("/login");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("heading", { name: "Collector dashboard" })).toBeInTheDocument();
  });

  it("recycler role reaches recycler dashboard", async () => {
    const user = userEvent.setup();
    await renderAt("/login");
    await user.click(screen.getByRole("button", { name: "Recycler demo" }));
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("heading", { name: "Recycler dashboard" })).toBeInTheDocument();
  });

  it("admin role reaches admin dashboard", async () => {
    const user = userEvent.setup();
    await renderAt("/login");
    await user.click(screen.getByRole("button", { name: "Admin demo" }));
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("heading", { name: "Admin dashboard" })).toBeInTheDocument();
  });

  it("blocks unauthorized role access", async () => {
    localStorage.setItem("vital_edges_demo_token", "demo-token-collector");
    await renderAt("/admin");
    expect(await screen.findByRole("heading", { name: "You do not have access to this area." })).toBeInTheDocument();
  });

  it("handles unknown routes", async () => {
    await renderAt("/missing-route");
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });
});