import { FormEvent, useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { demoUsers } from "../auth/demo-users";
import { useAuth } from "../auth/AuthContext";

const redirectByRole = {
  COLLECTOR: "/collector",
  RECYCLER: "/recycler",
  ADMIN: "/admin",
} as const;

export function LoginPage() {
  const { status, user, error, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(demoUsers[0].email);
  const [password, setPassword] = useState(demoUsers[0].password);
  const [isSubmitting, setSubmitting] = useState(false);
  const from = (location.state as { from?: string } | null)?.from;

  useEffect(() => {
    if (status === "authenticated" && user) {
      navigate(from ?? redirectByRole[user.role], { replace: true });
    }
  }, [from, navigate, status, user]);

  if (status === "authenticated" && user) {
    return <Navigate to={redirectByRole[user.role]} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await signIn(email, password);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto grid max-w-4xl gap-6 rounded-lg bg-white p-6 shadow-sm sm:grid-cols-[1fr_1.1fr]">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Demo authentication</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Sign in to Vital Edges</h1>
        <p className="mt-3 text-slate-600">Use deterministic demo accounts only. This local mode is not production Supabase authentication.</p>
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-slate-700" htmlFor="email">Email</label>
        <input id="email" className="min-h-12 w-full rounded-lg border border-slate-300 px-4" value={email} onChange={(event) => setEmail(event.target.value)} />
        <label className="block text-sm font-medium text-slate-700" htmlFor="password">Password</label>
        <input id="password" className="min-h-12 w-full rounded-lg border border-slate-300 px-4" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p> : null}
        <button className="min-h-12 w-full rounded-lg bg-emerald-700 px-4 font-semibold text-white disabled:bg-slate-400" disabled={isSubmitting || status === "loading"} type="submit">
          {isSubmitting || status === "loading" ? "Signing in..." : "Sign in"}
        </button>
        <div className="grid gap-2 sm:grid-cols-3" aria-label="Demo account shortcuts">
          {demoUsers.map((demoUser) => (
            <button key={demoUser.email} className="min-h-11 rounded-lg border border-emerald-200 px-3 text-sm font-medium text-emerald-900" type="button" onClick={() => { setEmail(demoUser.email); setPassword(demoUser.password); }}>
              {demoUser.label}
            </button>
          ))}
        </div>
      </form>
    </section>
  );
}