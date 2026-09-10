import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle } from "lucide-react";
import { getHealth } from "../api/client";

export function HealthBadge() {
  const query = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    retry: 1,
  });

  if (query.isLoading) {
    return <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">Checking backend...</span>;
  }

  if (query.isError) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-700" role="status">
        <AlertTriangle aria-hidden="true" size={16} /> Backend unavailable
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700" role="status">
      <Activity aria-hidden="true" size={16} /> Backend online
    </span>
  );
}