"use client";

import { useEffect } from "react";
import { ensureBuiltinLuts } from "@/lib/builtinLuts";

/**
 * One-shot initializer for built-in LUT presets.
 * Renders nothing — just triggers installation on first visit.
 */
export default function BuiltinLutsInit() {
  useEffect(() => {
    void ensureBuiltinLuts();
  }, []);
  return null;
}
