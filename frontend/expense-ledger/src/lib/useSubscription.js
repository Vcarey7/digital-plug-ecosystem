import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";
import { useAuth } from "./AuthProvider.jsx";

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export function useSubscription() {
  const { user } = useAuth();
  const [status, setStatus] = useState("loading");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setStatus("none");
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.from("subscriptions").select("status").eq("user_id", user.id).maybeSingle();
    if (error) {
      console.error("Failed to load subscription status", error);
      setStatus("none");
    } else {
      setStatus(data?.status ?? "none");
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    status,
    loading,
    active: ACTIVE_STATUSES.has(status),
    refresh,
  };
}
