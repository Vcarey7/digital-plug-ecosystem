import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import { PERSONAS } from "../data/mockData.js";

const CURATED = PERSONAS.map((p) => ({ ...p, source: "curated" }));

function monogramOf(name) {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function normalize(row) {
  const creatorName = row.profiles?.display_name;
  return {
    id: row.id,
    name: row.name,
    house: creatorName ? `Studio ${creatorName}` : "Independent creator",
    category: row.category,
    monogram: monogramOf(row.name),
    gradient: [row.gradient_from, row.gradient_to],
    tagline: row.tagline || `${row.backstory.slice(0, 90)}${row.backstory.length > 90 ? "…" : ""}`,
    backstory: row.backstory,
    tags: row.tags || [],
    rating: null,
    reviews: 0,
    licenses: {
      exclusive: { price: Number(row.exclusive_price), available: row.exclusive_available },
      shared: { price: Number(row.shared_price), licensedCount: 0 },
    },
    contentPacks: [],
    source: "live",
  };
}

export function useModels() {
  const [liveModels, setLiveModels] = useState([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;

    supabase
      .from("models")
      .select("*, profiles(display_name)")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) setLiveModels(data.map(normalize));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const models = [...liveModels, ...CURATED];

  return {
    models,
    loading,
    findModel: (id) => models.find((m) => m.id === id),
  };
}
