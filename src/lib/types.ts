/* ── Kinolu Type Definitions ── */

export interface EditParams {
  // Transfer
  method: string;
  color_strength: number;
  tone_strength: number;
  auto_xy: boolean;
  cinematic_enhance: boolean;
  cinematic_strength: number;
  skin_protect: boolean;
  semantic_regions: boolean;

  // Micro edits
  sat: number;
  vib: number;
  temp: number;
  tint: number;
  contrast: number;
  highlights: number;
  shadows: number;
  grain: number;
  sharpen: number;
  exposure: number;
  vignette: number;
  bloom: number;

  // Curves (per-channel)
  curve_points: CurveChannels;

  // HSL 7-way
  hsl7: HSL7Data;
}

export interface CurvePoint {
  x: number;
  y: number;
}

export interface CurveChannels {
  rgb: CurvePoint[];
  r: CurvePoint[];
  g: CurvePoint[];
  b: CurvePoint[];
}

export interface HSL7Band {
  hue: number;
  sat: number;
  light: number;
}

export type HSL7Key =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "aqua"
  | "blue"
  | "purple";

export type HSL7Data = Record<HSL7Key, HSL7Band>;

export interface TransferResponse {
  imageBlob: Blob;
  autoX: number;
  autoY: number;
  selectedMethod: string;
  ranking: string;
}

export interface PresetItem {
  id: string;
  name: string;
  source_type: "generated" | "imported_cube" | string;
  cube_file: string;
  created_at: string;
  updated_at: string;
}

export interface Capabilities {
  mediapipe?: boolean;
  mobile_sam_enabled?: boolean;
  mobile_sam_error?: string;
  mobile_sam_checkpoint?: string;
  methods: string[];
  // Optional fields for forward/backward compatibility.
  micro_edits?: string[];
  export_formats?: string[];
  max_resolution?: number;
}

export type AdjustmentTool =
  | "exposure"
  | "contrast"
  | "highlights"
  | "shadows"
  | "saturation"
  | "vibrance"
  | "warmth"
  | "tint"
  | "grain"
  | "sharpen"
  | "vignette"
  | "bloom";

export type EditorTab = "transfer" | "edit" | "curves" | "hsl" | "crop";

export const DEFAULT_EDIT_PARAMS: EditParams = {
  method: "reinhard_lab",
  color_strength: 0.88,
  tone_strength: 0.78,
  auto_xy: true,
  cinematic_enhance: true,
  cinematic_strength: 0.72,
  skin_protect: true,
  semantic_regions: true,

  sat: 0,
  vib: 0,
  temp: 0,
  tint: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  grain: 0,
  sharpen: 0,
  exposure: 0,
  vignette: 0,
  bloom: 0,

  curve_points: {
    rgb: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
    r: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
    g: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
    b: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
  },

  hsl7: {
    red: { hue: 0, sat: 0, light: 0 },
    orange: { hue: 0, sat: 0, light: 0 },
    yellow: { hue: 0, sat: 0, light: 0 },
    green: { hue: 0, sat: 0, light: 0 },
    aqua: { hue: 0, sat: 0, light: 0 },
    blue: { hue: 0, sat: 0, light: 0 },
    purple: { hue: 0, sat: 0, light: 0 },
  },
};

export const HSL_COLORS: { key: HSL7Key; hex: string; label: string }[] = [
  { key: "red", hex: "#ff3b30", label: "Red" },
  { key: "orange", hex: "#ff9500", label: "Orange" },
  { key: "yellow", hex: "#ffcc00", label: "Yellow" },
  { key: "green", hex: "#34c759", label: "Green" },
  { key: "aqua", hex: "#5ac8fa", label: "Aqua" },
  { key: "blue", hex: "#007aff", label: "Blue" },
  { key: "purple", hex: "#af52de", label: "Purple" },
];
