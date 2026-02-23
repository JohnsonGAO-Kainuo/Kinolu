"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconCamera, IconEdit, IconLibrary, IconUser } from "@/components/icons";

const CARDS = [
  {
    id: "camera",
    label: "CAMERA",
    desc: "Shoot & apply styles live",
    href: "/camera",
    icon: IconCamera,
    bg: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=1200&auto=format&fit=crop",
  },
  {
    id: "editor",
    label: "EDITOR",
    desc: "Import & grade your photos",
    href: "/editor",
    icon: IconEdit,
    bg: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?q=80&w=1200&auto=format&fit=crop",
  },
  {
    id: "library",
    label: "PRESETS",
    desc: "Browse your style collection",
    href: "/presets",
    icon: IconLibrary,
    bg: "https://images.unsplash.com/photo-1447703693928-9cd89c8d3ac5?q=80&w=1200&auto=format&fit=crop",
  },
] as const;

export default function HomePage() {
  const [active, setActive] = useState(0);
  const router = useRouter();

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 w-full safe-top px-6 flex justify-between items-center z-50 pointer-events-none">
        <div className="w-6" />
        <span className="text-[14px] font-bold tracking-[3px] text-white drop-shadow-lg">
          KINOLU
        </span>
        <button className="pointer-events-auto text-white/80 hover:text-white transition-colors drop-shadow-lg">
          <IconUser size={22} />
        </button>
      </div>

      {/* Accordion cards */}
      <div className="flex flex-col w-full h-full">
        {CARDS.map((card, i) => {
          const isActive = i === active;
          const Icon = card.icon;

          return (
            <div
              key={card.id}
              onClick={() => setActive(i)}
              className="relative overflow-hidden cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]"
              style={{
                flex: isActive ? 3 : 1,
                filter: isActive ? "brightness(1.05)" : "brightness(0.7)",
              }}
            >
              {/* Background image */}
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700"
                style={{
                  backgroundImage: `url(${card.bg})`,
                  transform: isActive ? "scale(1.02)" : "scale(1)",
                }}
              />

              {/* Overlay gradient */}
              <div
                className="absolute inset-0 transition-opacity duration-300"
                style={{
                  background: isActive
                    ? "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.4) 100%)"
                    : "rgba(0,0,0,0.45)",
                }}
              />

              {/* Content */}
              <div
                className="relative z-10 w-full h-full flex flex-col items-center justify-center"
                onClick={(e) => {
                  if (isActive) {
                    e.stopPropagation();
                    router.push(card.href);
                  }
                }}
              >
                {/* Icon (shown when inactive) */}
                <div
                  className="transition-all duration-500"
                  style={{
                    opacity: isActive ? 0 : 0.6,
                    transform: isActive ? "scale(0.5)" : "scale(1)",
                    position: "absolute" as const,
                  }}
                >
                  <Icon size={28} className="text-white" />
                </div>

                {/* Title & description (visible when active) */}
                <div
                  className="flex flex-col items-center transition-all duration-500"
                  style={{
                    opacity: isActive ? 1 : 0,
                    transform: isActive
                      ? "translateY(0)"
                      : "translateY(10px)",
                  }}
                >
                  <h2 className="text-[32px] font-extrabold tracking-[2px] text-white drop-shadow-lg">
                    {card.label}
                  </h2>
                  <p className="text-[13px] text-white/70 mt-1 font-medium tracking-wider uppercase">
                    {card.desc}
                  </p>
                  <div className="mt-4 px-6 py-2 border border-white/30 rounded-full text-[11px] font-semibold tracking-[2px] text-white/80 hover:bg-white/10 transition-colors uppercase">
                    Tap to Enter
                  </div>
                </div>

                {/* Label always visible for inactive */}
                <span
                  className="absolute text-[13px] font-bold tracking-[3px] text-white/60 uppercase transition-all duration-500"
                  style={{
                    opacity: isActive ? 0 : 1,
                    bottom: isActive ? "50%" : "16px",
                  }}
                >
                  {card.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
