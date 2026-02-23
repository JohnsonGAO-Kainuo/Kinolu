"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deletePresetById, importCubePreset, listPresets, presetCubeDownloadUrl, renamePreset } from "@/lib/api";
import type { PresetItem } from "@/lib/types";
import { IconBack, IconChevronRight, IconLUT, IconPlus } from "@/components/icons";

export default function PresetsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<PresetItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listPresets());
    } catch (err) {
      setError(`Load presets failed: ${err}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const generated = useMemo(() => items.filter((x) => x.source_type === "generated"), [items]);
  const imported = useMemo(() => items.filter((x) => x.source_type !== "generated"), [items]);

  const onImportCube = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importCubePreset(file);
      await refresh();
    } catch (err) {
      setError(`Import CUBE failed: ${err}`);
    } finally {
      e.target.value = "";
    }
  }, [refresh]);

  const onRename = useCallback(async (item: PresetItem) => {
    const name = window.prompt("New preset name", item.name);
    if (!name || !name.trim()) return;
    try {
      await renamePreset(item.id, name.trim());
      await refresh();
    } catch (err) {
      setError(`Rename failed: ${err}`);
    }
  }, [refresh]);

  const onDelete = useCallback(async (item: PresetItem) => {
    if (!window.confirm(`Delete preset "${item.name}"?`)) return;
    try {
      await deletePresetById(item.id);
      await refresh();
    } catch (err) {
      setError(`Delete failed: ${err}`);
    }
  }, [refresh]);

  const openEditorWithPreset = useCallback((item: PresetItem) => {
    router.push(`/editor?preset=${encodeURIComponent(item.id)}`);
  }, [router]);

  return (
    <div className="flex flex-col w-full h-full bg-black">
      <input
        ref={fileInputRef}
        type="file"
        accept=".cube,text/plain,application/octet-stream"
        className="hidden"
        onChange={onImportCube}
      />

      <div className="flex items-center justify-between h-[44px] px-4 safe-top shrink-0">
        <button onClick={() => router.push("/")} className="w-8 h-8 flex items-center justify-center text-white/60">
          <IconBack size={20} />
        </button>
        <span className="text-[12px] font-semibold tracking-[2.5px] uppercase text-white/70">Presets</span>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-8 h-8 rounded-full bg-white/[0.06] text-white/50 hover:text-white flex items-center justify-center"
          title="Import CUBE"
        >
          <IconPlus size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {error && (
          <div className="mt-3 rounded-lg border border-red-500/40 bg-red-900/30 px-3 py-2 text-[12px] text-red-100">
            {error}
          </div>
        )}

        <section className="mt-4">
          <div className="mb-2 text-[10px] tracking-[2px] uppercase text-white/30">Generated</div>
          {loading ? (
            <div className="text-[12px] text-k-muted">Loading...</div>
          ) : generated.length === 0 ? (
            <div className="text-[12px] text-k-muted">No generated presets yet.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {generated.map((item) => (
                <div key={item.id} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-semibold text-white/90">{item.name}</div>
                      <div className="text-[9px] text-white/30 mt-0.5">{new Date(item.updated_at).toLocaleString()}</div>
                    </div>
                    <button
                      onClick={() => openEditorWithPreset(item)}
                      className="rounded-lg border border-white/15 px-3 py-1 text-[10px] tracking-[1px] text-white/70 hover:bg-white/10 transition-colors"
                    >
                      APPLY
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <button
                      onClick={() => window.open(presetCubeDownloadUrl(item.id), "_blank")}
                      className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] px-2 py-0.5 text-[9px] text-white/40 hover:text-white/70 transition-colors"
                    >
                      <IconLUT size={10} />
                      CUBE
                    </button>
                    <button onClick={() => onRename(item)} className="rounded-md border border-white/[0.06] px-2 py-0.5 text-[9px] text-white/40 hover:text-white/70 transition-colors">
                      Rename
                    </button>
                    <button onClick={() => onDelete(item)} className="rounded-md border border-white/[0.06] px-2 py-0.5 text-[9px] text-red-400/60 hover:text-red-300 transition-colors">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-6">
          <div className="mb-2 text-[10px] tracking-[2px] uppercase text-white/30">Imported</div>
          {loading ? (
            <div className="text-[12px] text-k-muted">Loading...</div>
          ) : imported.length === 0 ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-between py-4 px-5 bg-white/[0.03] rounded-xl border border-white/[0.06] hover:border-white/15 transition-colors"
            >
              <div className="flex items-center gap-3">
                <IconLUT size={20} className="text-k-text-secondary" />
                <div className="flex flex-col items-start">
                  <span className="text-[12px] text-white font-semibold">Import .cube LUT</span>
                  <span className="text-[10px] text-k-text-secondary">Add external LUT files to your collection</span>
                </div>
              </div>
              <IconChevronRight size={18} className="text-k-muted" />
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              {imported.map((item) => (
                <div key={item.id} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-semibold text-white/90">{item.name}</div>
                      <div className="text-[9px] text-white/30 mt-0.5">CUBE • {new Date(item.updated_at).toLocaleString()}</div>
                    </div>
                    <button
                      onClick={() => openEditorWithPreset(item)}
                      className="rounded-lg border border-white/15 px-3 py-1 text-[10px] tracking-[1px] text-white/70 hover:bg-white/10 transition-colors"
                    >
                      APPLY
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <button
                      onClick={() => window.open(presetCubeDownloadUrl(item.id), "_blank")}
                      className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] px-2 py-0.5 text-[9px] text-white/40 hover:text-white/70 transition-colors"
                    >
                      <IconLUT size={10} />
                      CUBE
                    </button>
                    <button onClick={() => onRename(item)} className="rounded-md border border-white/[0.06] px-2 py-0.5 text-[9px] text-white/40 hover:text-white/70 transition-colors">
                      Rename
                    </button>
                    <button onClick={() => onDelete(item)} className="rounded-md border border-white/[0.06] px-2 py-0.5 text-[9px] text-red-400/60 hover:text-red-300 transition-colors">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
