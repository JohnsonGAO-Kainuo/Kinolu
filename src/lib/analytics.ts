/**
 * Lightweight Google Analytics / Google Ads event helper.
 * Fires gtag events for key user actions — works for both
 * anonymous and signed-in users.
 */

type GtagFn = (...args: unknown[]) => void;

function getGtag(): GtagFn | null {
  if (typeof window !== "undefined" && typeof (window as any).gtag === "function") {
    return (window as any).gtag as GtagFn;
  }
  return null;
}

const AW_ID = "AW-18006123691";

/** User opened the editor page */
export function trackEditorOpen() {
  getGtag()?.("event", "editor_open", { event_category: "engagement" });
}

/** User ran AI color transfer */
export function trackColorTransfer() {
  getGtag()?.("event", "color_transfer", { event_category: "core_action" });
  getGtag()?.("event", "conversion", { send_to: AW_ID, event_category: "core_action", event_label: "color_transfer" });
}

/** User applied a film preset */
export function trackPresetApply(presetId: string) {
  getGtag()?.("event", "preset_apply", { event_category: "core_action", preset_id: presetId });
}

/** User captured a photo with camera */
export function trackCameraCapture() {
  getGtag()?.("event", "camera_capture", { event_category: "core_action" });
}

/** User downloaded/exported a photo */
export function trackPhotoExport(method: "download" | "share" | "save_preset" | "export_lut") {
  getGtag()?.("event", "photo_export", { event_category: "conversion", method });
  getGtag()?.("event", "conversion", { send_to: AW_ID, event_category: "conversion", event_label: "photo_export" });
}

/** User opened the camera page */
export function trackCameraOpen() {
  getGtag()?.("event", "camera_open", { event_category: "engagement" });
}

/** User uploaded a source photo in editor */
export function trackPhotoUpload(type: "source" | "reference") {
  getGtag()?.("event", "photo_upload", { event_category: "engagement", upload_type: type });
}

/** User successfully subscribed to Pro */
export function trackPurchase(plan: "monthly" | "annual" | "lifetime") {
  const value = plan === "monthly" ? 2.99 : plan === "annual" ? 29.99 : 49.99;
  getGtag()?.("event", "purchase", {
    currency: "USD",
    value,
    items: [{ item_id: `kinolu_pro_${plan}`, item_name: `Kinolu Pro ${plan}`, price: value, quantity: 1 }],
  });
  getGtag()?.("event", "conversion", {
    send_to: AW_ID,
    value,
    currency: "USD",
    event_label: "subscription_purchase",
  });
}
