"use client";

import React, { useEffect, useMemo, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import api from "@/lib/api";
import Link from "next/link";

type ModelRow = { id: number; model_name: string; is_active: number; created_at?: string };
type VariantRow = { id: number; model_id: number; variant_name: string; is_active: number; created_at?: string };

function asNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function VehicleCatalogPage() {
  const [models, setModels] = useState<ModelRow[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);

  const [newModelName, setNewModelName] = useState("");
  const [newVariantName, setNewVariantName] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedModel = useMemo(
    () => models.find((m) => m.id === selectedModelId) || null,
    [models, selectedModelId]
  );

  const filteredVariants = useMemo(
    () => variants.filter((v) => v.model_id === selectedModelId),
    [variants, selectedModelId]
  );

  const loadModels = async () => {
    const res = await api.get("/api/admin/vehicle-catalog/models");
    setModels(res.data?.data || []);
  };

  const loadVariants = async (modelId: number) => {
    const res = await api.get("/api/admin/vehicle-catalog/variants", { params: { model_id: modelId } });
    setVariants(res.data?.data || []);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await loadModels();
      } catch (e: any) {
        setError(e?.response?.data?.message || "Failed to load models");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!selectedModelId) return;
      try {
        await loadVariants(selectedModelId);
      } catch (e: any) {
        setError(e?.response?.data?.message || "Failed to load variants");
      }
    })();
  }, [selectedModelId]);

  const addModel = async () => {
    setError(null);
    const name = newModelName.trim();
    if (!name) return setError("Model name required");
    try {
      setSaving(true);
      await api.post("/api/admin/vehicle-catalog/models", { model_name: name });
      setNewModelName("");
      await loadModels();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to add model");
    } finally {
      setSaving(false);
    }
  };

  const toggleModel = async (model: ModelRow) => {
    setError(null);
    try {
      setSaving(true);
      await api.put(`/api/admin/vehicle-catalog/models/${model.id}`, {
        is_active: model.is_active ? 0 : 1,
      });
      await loadModels();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to update model");
    } finally {
      setSaving(false);
    }
  };

  const addVariant = async () => {
    setError(null);
    if (!selectedModelId) return setError("Select a model first");
    const name = newVariantName.trim();
    if (!name) return setError("Variant name required");

    try {
      setSaving(true);
      await api.post("/api/admin/vehicle-catalog/variants", {
        model_id: selectedModelId,
        variant_name: name,
      });
      setNewVariantName("");
      await loadVariants(selectedModelId);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to add variant");
    } finally {
      setSaving(false);
    }
  };

  const toggleVariant = async (v: VariantRow) => {
    setError(null);
    try {
      setSaving(true);
      await api.put(`/api/admin/vehicle-catalog/variants/${v.id}`, { is_active: v.is_active ? 0 : 1 });
      if (selectedModelId) await loadVariants(selectedModelId);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to update variant");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthGuard>
      <div className="p-6">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Vehicle Catalog</h1>
            <p className="text-sm text-gray-600">Manage Model + Variant dropdown for Contacts.</p>
          </div>

          <Link href="/contacts" className="px-4 py-2 rounded border bg-white">
            ← Back to Contacts
          </Link>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-700">{error}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Models */}
          <div className="bg-white rounded-xl shadow-md p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Models</h2>
            </div>

            <div className="flex gap-2 mb-4">
              <input
                value={newModelName}
                onChange={(e) => setNewModelName(e.target.value)}
                placeholder="New model name (e.g., Splendor Plus)"
                className="flex-1 px-3 py-2 border rounded"
              />
              <button
                onClick={addModel}
                disabled={saving}
                className="px-4 py-2 rounded bg-gray-900 text-white disabled:opacity-60"
              >
                Add
              </button>
            </div>

            {loading ? (
              <div className="text-sm text-gray-600">Loading...</div>
            ) : models.length === 0 ? (
              <div className="text-sm text-gray-600">No models yet</div>
            ) : (
              <div className="border rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-2">Model</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {models.map((m) => {
                      const active = asNum(m.is_active) === 1;
                      const selected = m.id === selectedModelId;
                      return (
                        <tr key={m.id} className={selected ? "bg-gray-50" : ""}>
                          <td className="p-2 font-medium">
                            <button
                              className="underline"
                              onClick={() => setSelectedModelId(m.id)}
                              title="Select to manage variants"
                            >
                              {m.model_name}
                            </button>
                          </td>
                          <td className="p-2">{active ? "Active" : "Disabled"}</td>
                          <td className="p-2 flex gap-2 flex-wrap">
                            <button
                              onClick={() => setSelectedModelId(m.id)}
                              className="px-3 py-1 border rounded"
                            >
                              Manage Variants
                            </button>
                            <button
                              onClick={() => toggleModel(m)}
                              disabled={saving}
                              className="px-3 py-1 border rounded disabled:opacity-60"
                            >
                              {active ? "Disable" : "Enable"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Variants */}
          <div className="bg-white rounded-xl shadow-md p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Variants</h2>
              <div className="text-sm text-gray-600">
                {selectedModel ? (
                  <>
                    Model: <span className="font-semibold">{selectedModel.model_name}</span>
                    {asNum(selectedModel.is_active) !== 1 && (
                      <span className="ml-2 text-red-600">(model disabled)</span>
                    )}
                  </>
                ) : (
                  "Select a model"
                )}
              </div>
            </div>

            <div className="flex gap-2 mb-4">
              <input
                value={newVariantName}
                onChange={(e) => setNewVariantName(e.target.value)}
                placeholder="New variant name (e.g., i3S)"
                className="flex-1 px-3 py-2 border rounded"
                disabled={!selectedModelId}
              />
              <button
                onClick={addVariant}
                disabled={saving || !selectedModelId}
                className="px-4 py-2 rounded bg-gray-900 text-white disabled:opacity-60"
              >
                Add
              </button>
            </div>

            {!selectedModelId ? (
              <div className="text-sm text-gray-600">Choose a model from left side.</div>
            ) : filteredVariants.length === 0 ? (
              <div className="text-sm text-gray-600">No variants for this model</div>
            ) : (
              <div className="border rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-2">Variant</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVariants.map((v) => {
                      const active = asNum(v.is_active) === 1;
                      return (
                        <tr key={v.id}>
                          <td className="p-2 font-medium">{v.variant_name}</td>
                          <td className="p-2">{active ? "Active" : "Disabled"}</td>
                          <td className="p-2">
                            <button
                              onClick={() => toggleVariant(v)}
                              disabled={saving}
                              className="px-3 py-1 border rounded disabled:opacity-60"
                            >
                              {active ? "Disable" : "Enable"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="text-xs text-gray-500 mt-3">
              Tip: Disable old models/variants instead of deleting (keeps history).
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
