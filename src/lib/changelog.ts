/* ── Kinolu Changelog ──
 * Maintains version history for the What's New feature.
 * Keep entries in reverse chronological order.
 */

export interface ChangelogEntry {
  version: string;
  date: string;
  highlights: {
    en: string[];
    "zh-CN": string[];
    "zh-TW": string[];
  };
}

const changelog: ChangelogEntry[] = [
  {
    version: "0.2.0",
    date: "2026-02-28",
    highlights: {
      en: [
        "12 built-in film presets (Fuji, Kodak, Polaroid)",
        "Batch processing for Pro users",
        "XY pad for fine-tuning color & tone transfer",
        "Camera live LUT preview with selfie mirror",
        "Crop, curves, HSL editing tools",
        "Daily transfer limit for free users (10/day)",
        "Stripe subscription with monthly/annual/lifetime plans",
        "3 languages: English, 简体中文, 繁體中文",
      ],
      "zh-CN": [
        "12 款内置胶片预设（富士、柯达、拍立得）",
        "Pro 用户批量处理",
        "XY 触控板精调色彩和影调迁移",
        "相机实时 LUT 预览 + 自拍镜像",
        "裁剪、曲线、HSL 编辑工具",
        "免费用户每日转移次数限制（10次/天）",
        "Stripe 订阅：月度/年度/终身方案",
        "支持 3 种语言：English、简体中文、繁體中文",
      ],
      "zh-TW": [
        "12 款內建膠片預設（富士、柯達、拍立得）",
        "Pro 用戶批次處理",
        "XY 觸控板精調色彩和影調遷移",
        "相機即時 LUT 預覽 + 自拍鏡像",
        "裁剪、曲線、HSL 編輯工具",
        "免費用戶每日轉移次數限制（10次/天）",
        "Stripe 訂閱：月度/年度/終身方案",
        "支援 3 種語言：English、简体中文、繁體中文",
      ],
    },
  },
  {
    version: "0.1.0",
    date: "2026-02-15",
    highlights: {
      en: [
        "Initial release",
        "Color transfer engine with reference photos",
        "Camera with preset viewfinder",
        "Preset library with import/export",
      ],
      "zh-CN": [
        "首次发布",
        "基于参考图的色彩迁移引擎",
        "带预设取景的相机",
        "预设库：支持导入/导出",
      ],
      "zh-TW": [
        "首次發布",
        "基於參考圖的色彩遷移引擎",
        "帶預設取景的相機",
        "預設庫：支援匯入/匯出",
      ],
    },
  },
];

export const CURRENT_VERSION = changelog[0].version;

export default changelog;
