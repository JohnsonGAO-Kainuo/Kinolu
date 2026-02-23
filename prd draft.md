# Kinolu 色彩预设工具 PRD（草案）

## 1. 产品定位
- Kinolu 是一个极简的「电影感色彩复刻」工具：上传参考图 -> 一键套用到目标图 -> 导出预设。
- 产品叙事：`Dazz 的电影感审美 + ColorBy 的参考图匹配效率`。
- 一期目标：不做 AI，不做复杂参数学习，先把“好看、够快、可导出”做稳定。
- 核心价值：不仅生成效果图，还能导出可复用预设（LUT / XMP / Proxy DNG）。
- 下阶段定位：从“修图工具”升级为“移动端电影感创作入口”（PWA + 拍照 + 预设库）。

## 2. 关键决策（本期定版）
- 交互策略：只保留「一键套用」主路径，不让用户做多模式选择。
- 首页入口策略：只保留两个并列主按钮，`Shoot`（拍照）与 `Edit`（调色）；用户先二选一，再进入对应流程。
- `Fast / Adaptive` 不作为用户可见选项；如需适配，由系统内部自动处理。
- 前端主路径固定单算法：`reinhard_lab`（不向用户展示算法选择）。
- XY 控件采用 Kumo 风格的“中心吸附式二维拨盘”（保留数值显示与轻量吸附点）。
- `Cinematic Film Boost` 作为内置风格层默认开启，仅保留强度调节。
- 复古风格需明确分层：`Warm Gold / Soft Green / Neutral Matte` 三个 Vintage 家族（方向命名，不使用品牌商标命名）。
- `Skin Protection` 当前不作为用户可见开关，后端能力保留用于后续策略迭代。
- 素材库主来源：`Pexels API` + 运营精选（电影感/胶片风格/高反差夜景/低饱和人文等）。
- 用户上传参考图始终可用，和平台素材同权。
- 下阶段必须支持：PWA 拍照入口、平台预设保存、`.cube` 导入与复用。
- 下阶段必须支持：批量导入目标图（队列处理）与可折叠编辑区（Tone/Color/Curves/HSL/Film Finish）。
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

## 5. MVP 目标体验（当前 Web 版）
1. 选择参考图（平台精选 or Pexels or 用户上传）。
2. 上传目标图，点击 `Generate`。
3. 用二维强度控制微调：X 轴 `Color Strength`（色彩模仿强度 0-100%），Y 轴 `Tone Strength`（影调模仿强度 0-100%）；中心 = 参考图原样。支持拖拽 2D 拨盘或单独输入数值。
4. 导出（会员可导出 `.cube / .xmp / Proxy DNG`）。

### 5.0 首页分流（新增定版）
1. 用户进入首页，只看到两个主入口：`Shoot` 与 `Edit`。
2. 点 `Shoot`：进入相机拍照流，拍完自动进入生成与微调。
3. 点 `Edit`：进入参考图 + 目标图的标准调色流。
4. 两条路径最终都回到同一结果页、同一预设库、同一导出系统。

### 5.1 下一阶段目标体验（PWA 拍照版）
1. 用户在手机端打开 PWA，直接点击 `Shoot` 拍照。
2. 拍照后直接进入仿色流程（选择参考图或选择平台预设）。
3. 自动生成 + 自动放置 XY，用户仅做轻量微调。
4. 一键保存为平台预设，并可导出 `.cube / .xmp / DNG`。

### 5.2 下一阶段目标体验（批量导入版）
1. 用户选择一个参考图或一个平台预设。
2. 批量导入多张目标图（移动端建议 <=10，桌面 <=20）。
3. 统一应用当前 XY 与电影感强度，启动队列处理。
4. 查看每张进度与失败重试，最终支持单张或打包导出。

## 6. 核心功能需求（MoSCoW）

### MUST（一期必须）
- **轻量色彩迁移引擎接入**
  - 后端使用 Python + FastAPI 封装轻量算法栈（`colortrans` + OpenCV）。
  - 用户可见主引擎固定为 `reinhard_lab`，内置电影感增强层。
  - `hybrid_auto / reinhard / lhm / pccm` 仅用于离线评估与回归对比，不进入主 UI。
- **肤色保护（人像友好）**
  - 集成 MediaPipe Selfie Segmentation 生成皮肤/人脸蒙版。
  - 皮肤区域降低仿色强度或保持原色，避免偏肤。
  - 当前阶段该能力默认由系统策略控制，不作为用户可见按钮。
- **一键套用与基础调节**
  - 参考图 -> 目标图一键生成效果。
  - 提供双维强度调节：`Color Strength (X)` 与 `Tone Strength (Y)`，范围 0-100%，默认由 Auto XY 推荐。
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

### 6.2 下一阶段 MUST（PWA + 预设平台）
- **拍照入口**
  - 支持手机端 PWA 调起相机拍照并作为目标图。
  - 支持拍照后 `Retake / Use Photo` 双确认。
- **预设平台化**
  - 生成结果可保存为平台预设（名称、标签、缩略图、来源信息）。
  - 支持个人预设列表、应用、重命名、删除。
- **CUBE 导入复用**
  - 支持用户导入 `.cube` 并保存到个人预设库。
  - 导入后可直接用于拍照流和上传流。
- **移动端优先**
  - PWA 安装、离线壳、基础缓存、移动端触控优化。
- **批量导入与队列处理**
  - 支持多目标图批量导入，并复用同一参考图/预设。
  - 提供队列状态（等待/处理中/完成/失败）与失败重试。
- **编辑区完整化（默认折叠）**
  - Tone：Exposure/Contrast/Highlights/Shadows。
  - Color：Temperature/Tint/Saturation/Vibrance。
  - Curves：RGB 曲线分通道。
  - HSL：7 色（红橙黄绿青蓝紫）H/S/L。
  - Film Finish：Grain/Vignette/Bloom(Halation)。

### SHOULD（二期）
- 批量处理增强：断点续跑、失败自动重试策略、批量 ZIP 导出优化。
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
- 控件形式：Kumo 风格中心吸附式 XY，含中心死区与关键点轻吸附（25/50/75）。
- 默认由 Auto XY 推荐落点；用户拖拽后显示实时 X/Y 数值。
- 二维拨盘与单独滑杆二选一交互，界面只呈现一种，减少决策。

## 7. UI 设计定版（给 Gemini / Figma Make）
- 风格母版锁定：Figma `Camera Screen (Community)`（node `3:38`）作为唯一视觉基准。
- 交互参考锁定：`ref/colorby/*`（结果页与调色流程）+ `ref/kumo/*`（拍照与导入流程）。
- 视觉方向：移动端优先、简洁真实、低决策成本；避免蓝紫 AI 感配色与重拟物堆叠。
- 组件约束：底部三键胶囊导航（左/中/右）全页面复用，中心键始终视觉最强。
- 主路径固定：`导入 -> 生成 -> XY 微调 -> 保存/导出`，不增加模式分叉。
- 首页形态固定：两个主按钮并列布局（左 `Shoot`、右 `Edit`），避免复杂菜单。
- 主界面禁项：不显示算法下拉；不显示 `Skin Protection` 开关；不显示 `Cinematic` 开关（仅保留强度滑杆）。
- 图标约束：禁止 emoji，统一使用真实图标（SVG 风格一致）。
- 详见：`docs/GEMINI_UI_PROTOTYPE_PROMPTS.md` 与 `docs/FRONTEND_INTERACTION_SPEC.md`。

### 7.1 页面生成顺序（必须一张一张）
1. Camera Capture（先校准母版一致性）
2. Home / Create
3. Result + XY
4. Preset Library
5. Batch Import
6. Export Sheet
7. Editing Panel（展开态）
8. Desktop Companion

### 7.2 结果页交互定版（核心）
- 结果页必须有：Before/After 切换、大预览区、XY 二维面板、Film Strength 滑杆、保存/导出按钮。
- XY 定义固定：X=`Color Strength`，Y=`Tone Strength`。
- XY 可视化固定：中心死区、可拖拽旋钮、象限提示、实时数值。
- Auto XY 默认启用并显示落点提示；用户拖拽后进入手动态。

### 7.3 复古风格系统（明确）
- `Vintage Warm Gold`：暖高光、柔和黑位、轻颗粒、夜景友好。
- `Vintage Soft Green`：青绿暗部、克制饱和、街景/人文友好。
- `Neutral Matte Film`：低对比哑光、肤色自然、通用场景。
- 每个家族必须包含：风格说明、适用场景、默认强度建议、示例图。

### 7.4 AI 原型验收标准（生成即检查）
- 是否严格沿用母版（圆角、边框、按钮、导航、字体层级）？
- 是否只生成单页面（390x844），而不是拼图长图？
- 是否无算法下拉、无 Skin 开关、无 Cinematic 开关？
- 是否无 emoji，图标一致？
- 是否可以直接映射到 `docs/FRONTEND_INTERACTION_SPEC.md` 的真实交互？

## 8. 技术架构（可直接实施）

### 8.1 架构分层
- 前端：当前为轻量 Web Demo；下一阶段升级为移动优先 PWA（建议 React + TypeScript + camera flow）。
- 后端：FastAPI（色彩迁移、导出、额度与会员鉴权）。
- 算法引擎：以宽松协议组件为主（`dstein64/colortrans` + `opencv/opencv` + `colour-science/colour`）；MediaPipe 用于肤色/人脸分割蒙版。
- 导出模块：LUT Exporter / XMP Exporter / DNG Exporter。
- 后期轻量编辑：前端滑杆 -> 后端调用 OpenCV/NumPy 做曝光/对比/曲线/颗粒等简单滤镜，仍走 CPU。

### 8.6 PWA 与拍照架构（新增）
- PWA Manifest：支持安装、独立窗口、移动端图标。
- Service Worker：缓存静态资源与离线壳。
- Camera：`getUserMedia` 调起拍照，拍照结果直接进入仿色流程。
- Preset API（新增）：`/api/presets`、`/api/presets/import-cube`、`/api/presets/{id}`。
- Batch API（新增）：`/api/transfer/batch`、`/api/jobs/{id}`、`/api/jobs/{id}/retry-failed`、`/api/jobs/{id}/cancel`。
- 数据模型：Preset 包含 `name/tags/source_type/preview_url/export_assets/created_at`。

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
- **M1（已完成）**
  - 打通 Reference -> Generate -> 预览 -> 导出链路（JPG + CUBE + XMP + DNG 实验）。
  - 前端主路径简化为固定仿色引擎 + XY + 电影感强度。
- **M2（下一周）**
  - PWA 基础壳（Manifest + Service Worker + 移动端适配）。
  - Camera 流程（Shoot -> Confirm -> Generate）。
  - Preset 保存与列表管理（My Presets）。
  - Batch Import MVP（队列 + 进度 + 失败重试）。
  - 编辑区补全到 Tone/Color/Curves/HSL/Film Finish。
- **M3（后续 1-2 周）**
  - `.cube` 导入与预设复用闭环。
  - 会员能力接入与导出权限分层。
  - 批量处理与 A/B 对比优化。
  - Vintage 三家族风格包与示例体系上线。

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
- 批量导入在目标设备可稳定处理 >=10 张，且失败可重试。

## 14. 对外文案草案
- 主 Slogan：`Cinematic Looks, One Click.`
- 副文案：`像 Dazz 一样有电影氛围，像 ColorBy 一样高效匹配，还能导出专业预设。`
- 免费承诺：`每天 10 次免费复刻，满意再升级 Pro。`

## 15. 当前实施进度（2026-02-13）

### 15.1 已完成（可运行）
- 后端 API：`/api/transfer`、`/api/capabilities`、`/api/health` 已打通。
- 仿色方法：`hybrid_auto / reinhard_lab / reinhard / pccm / lhm` 均可运行。
- 前端主流程：固定 `reinhard_lab + cinematic`，不向用户暴露算法选择。
- 二维强度：已实现 X=Color Strength、Y=Tone Strength 分离混合。
- 语义分区：已接入 `MediaPipe + MobileSAM(可选)`，用于主体/天空/植被/肤色差异化强度（当前肤色开关不在主 UI 暴露）。
- 基础编辑：已提供 `Saturation / Vibrance / Temp / Tint / Contrast / Highlights / Shadows / Grain / Sharpen / HSL / 曲线`。
- 导出链路：已可产出 `preview.jpg + look_33.cube + look.xmp + look.dng(实验) + 一致性报告`。
- 数据集评估：已支持 CSV 清单批量跑分，自动输出 `results.json / summary.json / summary.md`。
- 稳定性压测：已支持方法 × 分辨率 × 迭代批量压测，自动输出 `stress_results.json / stress_summary.md`。
- 设计协作文档：已新增 `docs/FRONTEND_INTERACTION_SPEC.md` 与 `docs/GEMINI_UI_PROTOTYPE_PROMPTS.md`。

### 15.2 本地验证产物（已生成）
- 评估报告：`out/eval_user_real_v1/summary.md`
- 压测报告：`out/stress_user_real_v1/stress_summary.md`
- 导出闭环样例：`out/export_user_real_v2/export_report.json`

### 15.3 仍需优化（下一阶段）
- 肤色保护稳定性：在复杂光照/重妆/逆光下仍有偏差，需要继续调参与更细分区策略。
- DNG 专业度：当前为“流程验证型 DNG”（synthetic Bayer），需进一步验证 Lightroom/ACR 实际可编辑一致性。
- 评分体系增强：增加更强的主观质量指标与目标榜单（如 portrait/landscape 分榜）。
- 高分辨率吞吐：继续压测 20MP+ 场景并补充内存/耗时监控。
- PWA 拍照链路：补齐相机权限、失败回退、移动端稳定性测试。
- 预设平台能力：补齐保存/导入/应用/删除与权限控制闭环。
