import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { createEmptyDraft } from "../offline/draftRepository";

export function NewLotPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function create() {
      if (!user) return;
      try {
        const draft = await createEmptyDraft(user.id);
        if (!cancelled) navigate(`/collector/lots/${draft.localId}/edit`, { replace: true });
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not create local draft.");
      }
    }
    void create();
    return () => { cancelled = true; };
  }, [navigate, user]);

  return <section className="rounded-lg bg-white p-6 shadow-sm" role={error ? "alert" : "status"}>{error ?? "Preparing a new local draft..."}</section>;
}