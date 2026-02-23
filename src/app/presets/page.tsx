"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deletePresetById, importCubePreset, listPresets, presetCubeDownloadUrl, renamePreset } from "@/lib/api";
import type { PresetItem } from "@/lib/types";
import { IconBack, IconChevronRight, IconLUT, IconPlus } from "@/components/icons";
import { useI18n } from "@/lib/i18n";
import {
  type LutEntry,
  listLocalLuts,
  importCubeFileLocal,
  deleteLocalLut,
  renameLocalLut,
  exportCubeFile,
} from "@/lib/lutStore";

export default function PresetsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lutInputRef = useRef<HTMLInputElement>(null);

  // Server presets (requires backend)
  const [items, setItems] = useState<PresetItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendAvailable, setBackendAvailable] = useState(false);

  // Local LUTs (IndexedDB, always works)
  const [localLuts, setLocalLuts] = useState<Omit<LutEntry, "data">[]>([]);
  const [localLoading, setLocalLoading] = useState(true);

  const refreshLocal = useCallback(async () => {
    setLocalLoading(true);
    try {
      setLocalLuts(await listLocalLuts());
    } catch {
      /* ignore */
    } finally {
      setLocalLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listPresets();
      setItems(result);
      setBackendAvailable(true);
    } catch {
      setBackendAvailable(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    refreshLocal();
  }, [refresh, refreshLocal]);

  const generated = useMemo(() => items.filter((x) => x.source_type === "generated"), [items]);
  const imported = useMemo(() => items.filter((x) => x.source_type !== "generated"), [items]);

  /* ─── Server preset handlers ─── */
  const onImportCube = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importCubePreset(file);
      await refresh();
    } catch (err) {
      setError(`${t("lib_importFailed")}: ${err}`);
    } finally {
      e.target.value = "";
    }
  }, [refresh, t]);

  const onRename = useCallback(async (item: PresetItem) => {
    const name = window.prompt(t("lib_newName"), item.name);
    if (!name || !name.trim()) return;
    try {
      await renamePreset(item.id, name.trim());
      await refresh();
    } catch (err) {
      setError(`${t("lib_renameFailed")}: ${err}`);
    }
  }, [refresh, t]);

  const onDelete = useCallback(async (item: PresetItem) => {
    if (!window.confirm(t("lib_deleteConfirm").replace("{name}", item.name))) return;
    try {
      await deletePresetById(item.id);
      await refresh();
    } catch (err) {
      setError(`${t("lib_deleteFailed")}: ${err}`);
    }
  }, [refresh, t]);

  const openEditorWithPreset = useCallback((item: PresetItem) => {
    router.push(`/editor?preset=${encodeURIComponent(item.id)}`);
  }, [router]);

  /* ─── Local LUT handlers ─── */
  const onImportLocal = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importCubeFileLocal(file);
      await refreshLocal();
    } catch (err) {
      setError(`${t("lib_importFailed")}: ${err}`);
    } finally {
      e.target.value = "";
    }
  }, [refreshLocal, t]);

  const onRenameLocal = useCallback(async (entry: Omit<LutEntry, "data">) => {
    const name = window.prompt(t("lib_newName"), entry.name);
    if (!name || !name.trim()) return;
    try {
      await renameLocalLut(entry.id, name.trim());
      await refreshLocal();
    } catch (err) {
      setError(`${t("lib_renameFailed")}: ${err}`);
    }
  }, [refreshLocal, t]);

  const onDeleteLocal = useCallback(async (entry: Omit<LutEntry, "data">) => {
    if (!window.confirm(t("lib_deleteConfirm").replace("{name}", entry.name))) return;
    try {
      await deleteLocalLut(entry.id);
      await refreshLocal();
    } catch (err) {
      setError(`${t("lib_deleteFailed")}: ${err}`);
    }
  }, [refreshLocal, t]);

  const onExportLocal = useCallback(async (entry: Omit<LutEntry, "data">) => {
    try {
      const blob = await exportCubeFile(entry.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${entry.name}.cube`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(`Export failed: ${err}`);
    }
  }, []);

  const openEditorWithLocalLut = useCallback((entry: Omit<LutEntry, "data">) => {
    router.push(`/editor?localLut=${encodeURIComponent(entry.id)}`);
  }, [router]);

  return (
    <div className="flex flex-col w-full h-full bg-black">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".cube,text/plain,application/octet-stream"
        className="hidden"
        onChange={onImportCube}
      />
      <input
        ref={lutInputRef}
        type="file"
        accept=".cube,text/plain,application/octet-stream"
        className="hidden"
        onChange={onImportLocal}
      />

      {/* Header */}
      <div className="flex items-center justify-between h-[44px] px-4 safe-top shrink-0">
        <button onClick={() => { if (window.history.length > 1) router.back(); else router.push("/"); }} className="w-8 h-8 flex items-center justify-center text-white/60 active:text-white">
          <IconBack size={20} />
        </button>
        <span className="text-[12px] font-semibold tracking-[2.5px] uppercase text-white/70">{t("lib_title")}</span>
        <button
          onClick={() => lutInputRef.current?.click()}
          className="w-8 h-8 rounded-full bg-white/[0.06] text-white/50 hover:text-white flex items-center justify-center"
          title={t("lib_importLut")}
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

        {/* ─── Local LUTs (always available) ─── */}
        <section className="mt-4">
          <div className="mb-2 text-[10px] tracking-[2px] uppercase text-white/30">{t("lib_importLut")}</div>
          {localLoading ? (
            <div className="text-[12px] text-k-muted">{t("loading")}</div>
          ) : localLuts.length === 0 ? (
            <button
              onClick={() => lutInputRef.current?.click()}
              className="w-full flex items-center justify-between py-4 px-5 bg-white/[0.03] rounded-xl border border-white/[0.06] hover:border-white/15 transition-colors"
            >
              <div className="flex items-center gap-3">
                <IconLUT size={20} className="text-k-text-secondary" />
                <div className="flex flex-col items-start">
                  <span className="text-[12px] text-white font-semibold">{t("lib_importCube")}</span>
                  <span className="text-[10px] text-k-text-secondary">{t("lib_importLutDesc")}</span>
                </div>
              </div>
              <IconChevronRight size={18} className="text-k-muted" />
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              {localLuts.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-semibold text-white/90">{entry.name}</div>
                      <div className="text-[9px] text-white/30 mt-0.5">CUBE {entry.size}³ • {new Date(entry.createdAt).toLocaleString()}</div>
                    </div>
                    <button
                      onClick={() => openEditorWithLocalLut(entry)}
                      className="rounded-lg border border-white/15 px-3 py-1 text-[10px] tracking-[1px] text-white/70 hover:bg-white/10 transition-colors"
                    >
                      {t("lib_apply")}
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <button
                      onClick={() => onExportLocal(entry)}
                      className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] px-2 py-0.5 text-[9px] text-white/40 hover:text-white/70 transition-colors"
                    >
                      <IconLUT size={10} />
                      {t("lib_cube")}
                    </button>
                    <button onClick={() => onRenameLocal(entry)} className="rounded-md border border-white/[0.06] px-2 py-0.5 text-[9px] text-white/40 hover:text-white/70 transition-colors">
                      {t("rename")}
                    </button>
                    <button onClick={() => onDeleteLocal(entry)} className="rounded-md border border-white/[0.06] px-2 py-0.5 text-[9px] text-red-400/60 hover:text-red-300 transition-colors">
                      {t("delete")}
                    </button>
                  </div>
                </div>
              ))}
              {/* Add more button */}
              <button
                onClick={() => lutInputRef.current?.click()}
                className="mt-1 w-full py-2.5 rounded-xl border border-dashed border-white/[0.08] text-[11px] text-white/30 hover:text-white/50 hover:border-white/15 transition-colors"
              >
                + {t("lib_importCube")}
              </button>
            </div>
          )}
        </section>

        {/* ─── Server-generated presets (only when backend available) ─── */}
        {backendAvailable && (
          <section className="mt-6">
            <div className="mb-2 text-[10px] tracking-[2px] uppercase text-white/30">{t("lib_generated")}</div>
            {loading ? (
              <div className="text-[12px] text-k-muted">{t("loading")}</div>
            ) : generated.length === 0 ? (
              <div className="text-[12px] text-k-muted">{t("lib_noGenerated")}</div>
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
                        {t("lib_apply")}
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <button
                        onClick={() => window.open(presetCubeDownloadUrl(item.id), "_blank")}
                        className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] px-2 py-0.5 text-[9px] text-white/40 hover:text-white/70 transition-colors"
                      >
                        <IconLUT size={10} />
                        {t("lib_cube")}
                      </button>
                      <button onClick={() => onRename(item)} className="rounded-md border border-white/[0.06] px-2 py-0.5 text-[9px] text-white/40 hover:text-white/70 transition-colors">
                        {t("rename")}
                      </button>
                      <button onClick={() => onDelete(item)} className="rounded-md border border-white/[0.06] px-2 py-0.5 text-[9px] text-red-400/60 hover:text-red-300 transition-colors">
                        {t("delete")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ─── Server-imported presets (only when backend available) ─── */}
        {backendAvailable && imported.length > 0 && (
          <section className="mt-6">
            <div className="mb-2 text-[10px] tracking-[2px] uppercase text-white/30">{t("lib_imported")}</div>
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
                      {t("lib_apply")}
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <button
                      onClick={() => window.open(presetCubeDownloadUrl(item.id), "_blank")}
                      className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] px-2 py-0.5 text-[9px] text-white/40 hover:text-white/70 transition-colors"
                    >
                      <IconLUT size={10} />
                      {t("lib_cube")}
                    </button>
                    <button onClick={() => onRename(item)} className="rounded-md border border-white/[0.06] px-2 py-0.5 text-[9px] text-white/40 hover:text-white/70 transition-colors">
                      {t("rename")}
                    </button>
                    <button onClick={() => onDelete(item)} className="rounded-md border border-white/[0.06] px-2 py-0.5 text-[9px] text-red-400/60 hover:text-red-300 transition-colors">
                      {t("delete")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
