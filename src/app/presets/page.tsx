"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deletePresetById, importCubePreset, listPresets, presetCubeDownloadUrl, renamePreset } from "@/lib/api";
import type { PresetItem } from "@/lib/types";
import { IconBack, IconChevronRight, IconLUT, IconPlus } from "@/components/icons";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/components/AuthProvider";
import {
  type LutEntry,
  listLocalLuts,
  importCubeFileLocal,
  deleteLocalLut,
  renameLocalLut,
  exportCubeFile,
  updateLutThumbnail,
} from "@/lib/lutStore";
import { getBuiltinMeta } from "@/lib/builtinLuts";

export default function PresetsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { isPro } = useAuth();
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
  // Thumbnail URLs for generated presets
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});

  const refreshLocal = useCallback(async () => {
    setLocalLoading(true);
    try {
      const luts = await listLocalLuts();
      setLocalLuts(luts);
      // Build thumbnail URLs
      const urls: Record<string, string> = {};
      for (const lut of luts) {
        if (lut.thumbnail) {
          urls[lut.id] = URL.createObjectURL(lut.thumbnail);
        }
      }
      setThumbUrls((prev) => {
        // Revoke old URLs
        Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
        return urls;
      });
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
    return () => { Object.values(thumbUrls).forEach((u) => URL.revokeObjectURL(u)); };
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
      // Free users: max 5 user presets
      if (!isPro) {
        const userPresets = localLuts.filter((l) => !getBuiltinMeta(l.name));
        if (userPresets.length >= 5) {
          setError(t("editor_freePresetLimit"));
          return;
        }
      }
      await importCubeFileLocal(file);
      await refreshLocal();
    } catch (err) {
      setError(`${t("lib_importFailed")}: ${err}`);
    } finally {
      e.target.value = "";
    }
  }, [refreshLocal, t, isPro, localLuts]);

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

  /* ─── Cover change handler ─── */
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [coverTargetId, setCoverTargetId] = useState<string | null>(null);

  const onChangeCover = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !coverTargetId) return;
    try {
      // Resize to 200x200 thumbnail
      const bmp = await createImageBitmap(file, { resizeWidth: 200, resizeHeight: 200 });
      const c = document.createElement("canvas");
      c.width = 200; c.height = 200;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(bmp, 0, 0, 200, 200);
      const blob: Blob | null = await new Promise((r) => c.toBlob((b) => r(b), "image/jpeg", 0.85));
      if (blob) {
        await updateLutThumbnail(coverTargetId, blob);
        await refreshLocal();
      }
    } catch (err) {
      setError(`Cover change failed: ${err}`);
    } finally {
      setCoverTargetId(null);
      e.target.value = "";
    }
  }, [coverTargetId, refreshLocal]);

  const openEditorWithLocalLut = useCallback((entry: Omit<LutEntry, "data">) => {
    router.push(`/editor?localLut=${encodeURIComponent(entry.id)}`);
  }, [router]);

  // Filter out built-in presets — only show user presets
  const userLuts = useMemo(() => localLuts.filter((l) => !getBuiltinMeta(l.name)), [localLuts]);

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
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onChangeCover}
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
        {/* Hint */}
        <div className="mt-3 text-[10px] text-white/25 text-center leading-relaxed">
          {t("lib_hint")}
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-red-500/40 bg-red-900/30 px-3 py-2 text-[12px] text-red-100">
            {error}
          </div>
        )}

        {/* ─── User Presets Only ─── */}
        <section className="mt-4">
          {localLoading ? (
            <div className="text-[12px] text-k-muted">{t("loading")}</div>
          ) : userLuts.length === 0 ? (
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
            <div className="grid grid-cols-2 gap-2.5">
              {userLuts.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
                  {/* Thumbnail — tap to change cover */}
                  <div className="relative w-full aspect-[4/3] bg-black/40 overflow-hidden group">
                    {thumbUrls[entry.id] ? (
                      <img src={thumbUrls[entry.id]} alt={entry.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
                        <IconLUT size={24} className="text-white/15" />
                        <span className="text-[8px] text-white/20 tracking-wider">CUBE {entry.size}³</span>
                      </div>
                    )}
                    {/* Cover change overlay */}
                    <button
                      onClick={() => { setCoverTargetId(entry.id); coverInputRef.current?.click(); }}
                      className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <span className="text-[9px] text-white/70 bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1">{t("lib_changeCover")}</span>
                    </button>
                  </div>
                  {/* Info row — simplified */}
                  <div className="px-2.5 py-2">
                    <div className="truncate text-[11px] font-semibold text-white/90">{entry.name}</div>
                    <div className="text-[8px] text-white/30 mt-0.5">
                      {entry.sourceType === "generated" ? "✨ Generated" : `CUBE ${entry.size}³`} · {new Date(entry.createdAt).toLocaleDateString()}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1">
                      <button
                        onClick={() => onExportLocal(entry)}
                        className="rounded-md border border-white/[0.06] px-2 py-1 text-[8px] text-white/40 hover:text-white/70 transition-colors"
                        title="Export .cube"
                      >
                        <IconLUT size={9} />
                      </button>
                      <button onClick={() => onRenameLocal(entry)} className="rounded-md border border-white/[0.06] px-2 py-1 text-[8px] text-white/40 hover:text-white/70 transition-colors">
                        ✏️
                      </button>
                      <div className="flex-1" />
                      <button onClick={() => onDeleteLocal(entry)} className="rounded-md border border-white/[0.06] px-2 py-1 text-[8px] text-red-400/60 hover:text-red-300 transition-colors">
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ─── Server-generated presets (only when backend available) ─── */}
        {backendAvailable && generated.length > 0 && (
          <section className="mt-6">
            <div className="mb-2 text-[10px] tracking-[2px] uppercase text-white/30">{t("lib_generated")}</div>
            <div className="flex flex-col gap-2">
              {generated.map((item) => (
                <div key={item.id} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-semibold text-white/90">{item.name}</div>
                      <div className="text-[9px] text-white/30 mt-0.5">{new Date(item.updated_at).toLocaleString()}</div>
                    </div>
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
