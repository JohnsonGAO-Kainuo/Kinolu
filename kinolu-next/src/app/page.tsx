"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconCamera, IconEdit, IconLibrary } from "@/components/icons";
import { usePWAInstall } from "@/lib/usePWAInstall";

const CARDS = [
  {
    id: "camera",
    label: "Camera",
    desc: "Shoot with style",
    href: "/camera",
    icon: IconCamera,
    bg: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=1200&auto=format&fit=crop",
  },
  {
    id: "editor",
    label: "Editor",
    desc: "Import & grade",
    href: "/editor",
    icon: IconEdit,
    bg: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?q=80&w=1200&auto=format&fit=crop",
  },
  {
    id: "library",
    label: "Presets",
    desc: "Your collection",
    href: "/presets",
    icon: IconLibrary,
    bg: "https://images.unsplash.com/photo-1447703693928-9cd89c8d3ac5?q=80&w=1200&auto=format&fit=crop",
  },
] as const;

export default function HomePage() {
  const [active, setActive] = useState(0);
  const router = useRouter();
  const { canInstall, promptInstall } = usePWAInstall();

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Wordmark */}
      <div className="absolute top-0 left-0 w-full safe-top px-6 flex justify-between items-center z-50 pointer-events-none">
        <div className="w-6" />
        <span className="text-[13px] font-bold tracking-[4px] text-white/90 drop-shadow-lg">
          KINOLU
        </span>
        {canInstall ? (
          <button onClick={promptInstall} className="pointer-events-auto text-[9px] tracking-[1.5px] text-white/50 border border-white/15 rounded-full px-2.5 py-1 hover:text-white/80 transition-colors">
            INSTALL
          </button>
        ) : (
          <div className="w-6" />
        )}
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
                filter: isActive ? "brightness(1.05)" : "brightness(0.6)",
              }}
            >
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700"
                style={{
                  backgroundImage: `url(${card.bg})`,
                  transform: isActive ? "scale(1.02)" : "scale(1)",
                }}
              />
              <div
                className="absolute inset-0 transition-opacity duration-300"
                style={{
                  background: isActive
                    ? "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.5) 100%)"
                    : "rgba(0,0,0,0.5)",
                }}
              />
              <div
                className="relative z-10 w-full h-full flex flex-col items-center justify-center"
                onClick={(e) => { if (isActive) { e.stopPropagation(); router.push(card.href); } }}
              >
                {/* Icon — collapsed */}
                <div
                  className="transition-all duration-500 absolute"
                  style={{ opacity: isActive ? 0 : 0.5, transform: isActive ? "scale(0.5)" : "scale(1)" }}
                >
                  <Icon size={26} className="text-white" />
                </div>

                {/* Content — expanded */}
                <div
                  className="flex flex-col items-center transition-all duration-500"
                  style={{ opacity: isActive ? 1 : 0, transform: isActive ? "translateY(0)" : "translateY(10px)" }}
                >
                  <h2 className="text-[28px] font-extrabold tracking-[2px] text-white drop-shadow-lg uppercase">{card.label}</h2>
                  <p className="text-[11px] text-white/60 mt-0.5 tracking-[2px] uppercase">{card.desc}</p>
                  <div className="mt-4 px-5 py-1.5 border border-white/25 rounded-full text-[10px] tracking-[2px] text-white/70 hover:bg-white/10 transition-colors uppercase">
                    Open
                  </div>
                </div>

                {/* Label — collapsed */}
                <span
                  className="absolute text-[11px] font-bold tracking-[3px] text-white/50 uppercase transition-all duration-500"
                  style={{ opacity: isActive ? 0 : 1, bottom: isActive ? "50%" : "14px" }}
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
