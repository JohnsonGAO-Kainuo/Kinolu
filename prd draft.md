# Kinolu 色彩预设工具 PRD（草案）

## 1. 产品定位
- Kinolu 是一个极简的「电影感色彩复刻」工具：上传参考图 -> 一键套用到目标图 -> 导出预设。
- 产品叙事：`Dazz 的电影感审美 + ColorBy 的参考图匹配效率`。
- 一期目标：不做 AI，不做复杂参数学习，先把“好看、够快、可导出”做稳定。
- 核心价值：不仅生成效果图，还能导出可复用预设（LUT / XMP / Proxy DNG）。

## 2. 关键决策（本期定版）
- 交互策略：只保留「一键套用」主路径，不让用户做多模式选择。
- `Fast / Adaptive` 不作为用户可见选项；如需适配，由系统内部自动处理。
- 素材库主来源：`Pexels API` + 运营精选（电影感/胶片风格/高反差夜景/低饱和人文等）。
- 用户上传参考图始终可用，和平台素材同权。
- 商业模式：`免费日额 + Pro 会员`，不做 credit。
- Pro 统一价格：`$3/月`（按当地商店汇率自动换算展示）。
- 不再使用 ColorTransferLib；核心引擎选 `colortrans + OpenCV`，优先保持 MIT/BSD/Apache 协议。
- 不内置品牌官方 LUT（Fuji/Kodak），初期提供自研 Film Pack；如需品牌命名 LUT，需额外授权后再上线。

## 3. 导出格式兼容性

| 导出格式 | 兼容软件 | 备注 |
|---------|---------|------|
| **.cube** (3D LUT) | DaVinci Resolve、Premiere Pro、Final Cut Pro、After Effects、Photoshop、CapCut/剪映、VN | 行业通用标准 |
| **.xmp** (Lightroom 预设) | Lightroom Classic、Lightroom CC、Lightroom Mobile、Camera Raw | Lightroom 生态核心格式 |
| **Proxy DNG** | Lightroom Mobile（iOS/Android） | 用于移动端复制/粘贴设定流程 |
| **HaldCLUT PNG** | Affinity Photo、RawTherapee、GIMP | 第二优先级导出 |

## 4. 用户与场景
- 短视频创作者：快速做“电影感同款”并导出 LUT 给剪辑软件。
- 摄影爱好者：参考胶片风格图，一键得到可用于 Lightroom 的预设。
- 设计与品牌内容团队：同一风格批量套用，保持视觉一致。

## 5. MVP 目标体验（4 步）
1. 选择参考图（平台精选 or Pexels or 用户上传）。
2. 上传目标图，点击 `Generate`。
3. 用二维强度控制微调：X 轴 `Color Strength`（色彩模仿强度 0-100%），Y 轴 `Tone Strength`（影调模仿强度 0-100%）；中心 = 参考图原样。支持拖拽 2D 拨盘或单独输入数值。
4. 导出（会员可导出 `.cube / .xmp / Proxy DNG`）。

## 6. 核心功能需求（MoSCoW）

### MUST（一期必须）
- **轻量色彩迁移引擎接入**
  - 后端使用 Python + FastAPI 封装轻量算法栈（`colortrans` + OpenCV）。
  - 首批稳定算法白名单：`reinhard / pccm / lhm`。
  - 不暴露算法名给用户，统一为“一键电影感复刻”。
- **肤色保护（人像友好）**
  - 集成 MediaPipe Selfie Segmentation 生成皮肤/人脸蒙版。
  - 皮肤区域降低仿色强度或保持原色，避免偏肤。
- **一键套用与基础调节**
  - 参考图 -> 目标图一键生成效果。
  - 提供双维强度调节：`Color Strength (X)` 与 `Tone Strength (Y)`，范围 0-100%，默认 100%/100%。
  - 提供原图/效果切换。
- **素材库（Pexels + 精选）**
  - 接入 Pexels API 获取可商用素材缩略图。
  - 运营维护电影感主题集合（如 Neo-noir、Kodak-like、Muted Film）。
  - 用户可收藏参考图到个人库。
- **会员与额度机制**
  - 免费用户：每日 `10` 次生成额度。
  - Pro 用户：不限次数（可配公平使用阈值防滥用）。
- **导出能力（按会员分层）**
  - 免费：导出预览图/JPG。
  - Pro：导出 `.cube / .xmp / Proxy DNG`。

### SHOULD（二期）
- 批量处理（同预设套多图，一次下载）。
- A/B 滑杆对比。
- HaldCLUT PNG 导出。
- 轻量编辑面板（可选）：曝光/对比/高光/阴影/颗粒/锐化的小面板，默认折叠；仅在用户需要微调时展开。

### COULD（三期）
- 2D 拨盘微调（色温/光影）作为高级面板，默认折叠。
- 参考图多选混合风格。
- 离线桌面版（PWA/Electron）。

### FUTURE（远期）
- AI 语义调色（天空/人脸/背景分区）仅在证明显著增益后引入。

### 6.1 二维拨盘实现细节
- X=色彩混合系数（0-100%）：`output_chroma = src_chroma*(1-x) + transferred_chroma*x`。
- Y=影调混合系数（0-100%）：`output_luma = src_luma*(1-y) + transferred_luma*y`，可附加 S 曲线以避免压暗。
- 肤色保护：MediaPipe Selfie Segmentation 生成蒙版，对肤色区降低 x/y 权重。
- 默认 100/100；二维拨盘与单独滑杆二选一交互，界面只呈现一种，减少决策。

## 7. UI 设计（极简，去模式负担）
- 双栏布局：左侧参考图，右侧预览图。
- 主区保留：`Generate`、`Color Strength`、`Tone Strength`（可用 2D 拨盘或独立滑杆）、`Show Original`、`Export`。
- 不展示 `Fast/Adaptive`，不展示算法名。
- 顶部显示今日免费额度（如 `Free: 7/10`）。
- 导出菜单中对 Pro 功能显示锁标识（`.cube / .xmp / Proxy DNG`）。
- 轻量编辑面板：默认折叠，内含 `Exposure / Contrast / Highlights / Shadows / Grain / Sharpen`，滑杆范围窄，便于小幅修正。

### 7.1 UI 模拟草图（更新）

```
┌──────────────────────────────────────────────────────────────┐
│ Kinolu                         Free Today: 7/10   [Upgrade]  │
├────────────────────────┬─────────────────────────────────────┤
│                        │                                     │
│  Reference Image       │              Preview                │
│  ┌────────────────┐    │   ┌─────────────────────┐           │
│  │  Pexels/上传/精选 │    │   │                     │           │
│  │  参考图区域       │    │   │   效果预览图         │           │
│  └────────────────┘    │   └─────────────────────┘           │
│                        │                                     │
│ [Generate]             │ Color ●━━━━━━━━━━ 100%              │
│                        │ Tone  ●━━━━━━━━━━ 100%              │
│                        │ or 2D pad (X=color, Y=tone)         │
│                        │ [Show Original] [Export ▾]          │
│                        │ JPG / .cube(Pro) / .xmp(Pro) / DNG  │
├────────────────────────┴─────────────────────────────────────┤
│  Cinematic Library (Pexels + Curated)               [+ 上传] │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐              │
│  │ Film │ │ Noir │ │ Warm │ │ Cool │ │ Grain│    ...       │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘              │
└──────────────────────────────────────────────────────────────┘
```

## 8. 技术架构（可直接实施）

### 8.1 架构分层
- 前端：React + TypeScript（上传、预览、额度显示、导出）。
- 后端：FastAPI（色彩迁移、导出、额度与会员鉴权）。
- 算法引擎：以宽松协议组件为主（`dstein64/colortrans` + `opencv/opencv` + `colour-science/colour`）；MediaPipe 用于肤色/人脸分割蒙版。
- 导出模块：LUT Exporter / XMP Exporter / DNG Exporter。
- 后期轻量编辑：前端滑杆 -> 后端调用 OpenCV/NumPy 做曝光/对比/曲线/颗粒等简单滤镜，仍走 CPU。

### 8.2 素材库策略（Pexels）
- Pexels 作为主素材 API；我们仅拉取缩略图供用户挑选参考，不提供原图下载，也不镜像图库。
- 参考图用途：用户选择后我们在后台读取图像做色彩/影调特征提取（属于生成衍生 LUT），不直接分发原图；遵循 Pexels API 归因与禁止条款（不搭建竞争图库、不二次销售原素材）。
- 本地缓存缩略图与主题标签，提高加载速度。
- 按 API 与许可证要求展示来源信息与必要归因。

### 8.3 LUT 策略（合规）
- 内置「自研 Film Pack」：仅采用开源宽松协议或自制 LUT，不使用品牌商标命名。
- 用户可导入自有 LUT；上传时提示不可上传侵权/商业受限内容。
- 若未来引入 Fuji/Kodak 命名 LUT，需先完成品牌授权与法律审查。

### 8.4 为什么不用前端算法移植
- 纯前端图像算法链路在精度、兼容和性能上调优成本高。
- 先后端封装可快速上线验证用户价值，再决定是否前端化。

### 8.5 许可证策略（强约束）
- 依赖白名单：`MIT / BSD-2 / BSD-3 / Apache-2.0 / ISC`。
- 依赖黑名单：`GPL / AGPL / LGPL / 无 License`（默认不接入生产环境）。
- 素材与代码分开治理：Pexels API 受平台条款约束，不等同开源许可证。
- 引入新仓库前必须做许可证审计（仓库 License + 关键依赖 License + 模型权重 License）。
- 每次版本发布前产出一次许可证清单（SBOM 或 pip license 报告）并归档。

## 9. 会员与计费

### 9.1 免费版（Free）
- 每日 `10` 次生成。
- 可用平台素材库 + 用户上传。
- 可导出 JPG 结果图。

### 9.2 会员版（Pro）
- 价格：`$3/月`（统一定价策略）。
- 解锁：不限次生成、`.cube / .xmp / Proxy DNG` 导出、批量处理（二期生效）、自研 Film Pack。
- 不引入 credit，不让用户理解复杂计费。

## 10. 开发里程碑
- **M1（1-2 周）**
  - 打通 Reference -> Generate -> 预览 -> JPG 导出。
  - 上线免费日额 10 次。
  - 集成 MediaPipe 肤色保护（基础版本：皮肤区域降低仿色强度）。
- **M2（1-2 周）**
  - 接入会员系统，解锁 `.cube / .xmp / Proxy DNG`。
  - 接入 Pexels API 与主题精选库。
- **M3（1-2 周）**
  - 批量处理、A/B 对比、HaldCLUT。

## 11. 测试计划
- **功能冒烟**：每天验证上传、生成、强度调节、导出链路。
- **计费与额度**：重点验证“免费 10 次/天”重置、Pro 解锁逻辑。
- **格式兼容**：`.cube` 在 DaVinci/Premiere，`.xmp`/DNG 在 Lightroom Mobile/Classic 可用。
- **素材合规**：抽检 Pexels 来源展示、链接与归因是否正确。
- **许可证合规**：每周执行依赖许可证扫描，阻断黑名单协议进入主分支。
- **性能**：12MP 单图 <= 6s（CPU 基线）。

## 12. 风险与缓解
- **$3 定价过低导致利润压力**：通过 Pro 专业导出能力做转化，后续可补年费方案提升 ARPU。
- **免费额度被刷**：设备指纹 + 账号 + 频率限制 + 风控黑名单。
- **素材许可误用风险**：严格按 Pexels API 使用规范，仅作参考图入口。
- **许可证风险**：坚持白名单协议和发布前审计，禁止 GPL/无 License 依赖进入生产。
- **人像偏色风险**：一期上线肤色保护并提供强度上限。
- **品牌 LUT 合规风险**：不分发 Fuji/Kodak 官方 LUT；如需上线品牌命名 LUT，需先完成授权与法务审查。

## 13. 验收标准（一期）
- 用户 4 步内完成一次“电影感复刻”。
- 免费用户额度机制稳定（10 次/日准确重置）。
- Pro 订阅后可成功导出 `.cube / .xmp / Proxy DNG`。
- 主要目标软件导入成功，效果与站内预览偏差可接受。

## 14. 对外文案草案
- 主 Slogan：`Cinematic Looks, One Click.`
- 副文案：`像 Dazz 一样有电影氛围，像 ColorBy 一样高效匹配，还能导出专业预设。`
- 免费承诺：`每天 10 次免费复刻，满意再升级 Pro。`

## 15. 当前实施进度（2026-02-13）

### 15.1 已完成（可运行）
- 后端 API：`/api/transfer`、`/api/capabilities`、`/api/health` 已打通。
- 仿色方法：`hybrid_auto / reinhard_lab / reinhard / pccm / lhm` 均可运行。
- 二维强度：已实现 X=Color Strength、Y=Tone Strength 分离混合。
- 语义分区：已接入 `MediaPipe + MobileSAM(可选)`，并用于主体/天空/植被/肤色差异化强度。
- 基础编辑：已提供 `Saturation / Vibrance / Temp / Tint / Contrast / Highlights / Shadows / Grain / Sharpen / HSL / 曲线`。
- 导出链路：已可产出 `preview.jpg + look_33.cube + look.xmp + look.dng(实验) + 一致性报告`。
- 数据集评估：已支持 CSV 清单批量跑分，自动输出 `results.json / summary.json / summary.md`。
- 稳定性压测：已支持方法 × 分辨率 × 迭代批量压测，自动输出 `stress_results.json / stress_summary.md`。

### 15.2 本地验证产物（已生成）
- 评估报告：`out/eval_user_real_v1/summary.md`
- 压测报告：`out/stress_user_real_v1/stress_summary.md`
- 导出闭环样例：`out/export_user_real_v2/export_report.json`

### 15.3 仍需优化（下一阶段）
- 肤色保护稳定性：在复杂光照/重妆/逆光下仍有偏差，需要继续调参与更细分区策略。
- DNG 专业度：当前为“流程验证型 DNG”（synthetic Bayer），需进一步验证 Lightroom/ACR 实际可编辑一致性。
- 评分体系增强：增加更强的主观质量指标与目标榜单（如 portrait/landscape 分榜）。
- 高分辨率吞吐：继续压测 20MP+ 场景并补充内存/耗时监控。
