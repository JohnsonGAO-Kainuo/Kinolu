"use client";

import React, { useRef } from "react";
import { IconPlus } from "./icons";

interface ThumbStripProps {
  /** Object URLs or image paths */
  images: string[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
}

export default function ThumbStrip({
  images,
  activeIndex,
  onSelect,
  onAdd,
}: ThumbStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={scrollRef}
      className="flex items-center gap-3 px-5 py-3 overflow-x-auto"
      style={{ scrollbarWidth: "none" }}
    >
      {images.map((src, i) => (
        <button
          key={i}
          onClick={() => onSelect(i)}
          className={`flex-shrink-0 w-11 h-11 rounded-lg overflow-hidden transition-all ${
            i === activeIndex
              ? "ring-2 ring-white scale-105 opacity-100"
              : "opacity-50 hover:opacity-80"
          }`}
        >
          <img
            src={src}
            alt={`Reference ${i + 1}`}
            className="w-full h-full object-cover"
          />
        </button>
      ))}

      {/* Add button */}
      <button
        onClick={onAdd}
        className="flex-shrink-0 w-11 h-11 rounded-lg border border-dashed border-k-border-light flex items-center justify-center hover:border-white/40 transition-colors"
      >
        <IconPlus size={16} className="text-k-muted" />
      </button>
    </div>
  );
}
