import type { UserRole } from "../domain/roles";

export type DemoUser = {
  email: string;
  password: string;
  token: string;
  role: UserRole;
  label: string;
};

export const demoUsers: readonly DemoUser[] = [
  {
    email: "collector@demo.local",
    password: "DemoPass123!",
    token: "demo-token-collector",
    role: "COLLECTOR",
    label: "Collector demo",
  },
  {
    email: "recycler@demo.local",
    password: "DemoPass123!",
    token: "demo-token-recycler",
    role: "RECYCLER",
    label: "Recycler demo",
  },
  {
    email: "admin@demo.local",
    password: "DemoPass123!",
    token: "demo-token-admin",
    role: "ADMIN",
    label: "Admin demo",
  },
] as const;

export function findDemoUser(email: string, password: string): DemoUser | undefined {
  return demoUsers.find((user) => user.email === email.trim().toLowerCase() && user.password === password);
}