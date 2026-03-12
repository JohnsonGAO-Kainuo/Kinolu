# Kinolu — 技术核心 & 宣传文案

> 本文档包含 Kinolu 项目的**真实技术描述**，用于：
> 1. 入境处续签面谈时的技术陈述
> 2. 小红书 / X (Twitter) 社交媒体宣传文案
> 3. 投资人/合作方的技术说明
>
> **所有内容均基于代码实现，经过逐行审计，不含虚假声明。**

---

## 一、技术核心 — 真实描述（入境处可用）

### 1.1 色彩迁移引擎（Color Transfer Engine）

**基础算法：** Reinhard et al. (2001) 的 LAB 色彩空间统计匹配算法。  
这是一个经典的学术论文算法（发表于 IEEE），属于**公开的学术方法**，不是某个公司的专有技术。

**我们的自研部分：**

| 模块 | 来源 | 我们做了什么 |
|------|------|------------|
| LAB 统计匹配 | Reinhard et al. 2001 论文 | 用 TypeScript 从零实现，适配浏览器端运行（原论文是 C++ 桌面端） |
| 33³ 3D LUT 构建 | 自研 | 将 Reinhard 转换编码为 3D 查找表，实现 O(1) 实时预览，支持 XY 双轴（色彩/影调）独立强度控制 |
| Chroma 直方图匹配 | 自研 | 在 Reinhard 基础上增加 a/b 通道 CDF 直方图匹配（amount=0.18），细化色彩分布 |
| 电影感增强 (Cinematic Tone) | 自研 | Film toe/shoulder S 曲线 + 自适应百分位色调映射 + 色度密度推进，基于 Colorby 基准校准 |
| Auto XY 推荐 | 自研 | 基于 LAB 均值/标准差差异 + 语义遮罩权重的连续函数，自动推荐色彩/影调混合强度 |

### 1.2 语义分割与区域感知混合（Semantic Segmentation & Region-Aware Blending）

| 模块 | 来源 | 说明 |
|------|------|------|
| 人物分割 | Google MediaPipe Selfie Segmenter（开源模型） | 我们集成 MediaPipe 的 TFLite 模型，在浏览器端通过 WebGPU/WASM 运行 |
| 人脸检测 | Google MediaPipe BlazeFace（开源模型） | 短距离人脸检测模型，用于生成椭圆形人脸遮罩 |
| 皮肤检测 | 自研 | YCrCb + HSV 双色彩空间启发式检测算法，双探测器交叉验证 + 形态学平滑 |
| 天空检测 | 自研 | 色相 + 饱和度 + 图像位置权重的启发式算法 |
| 植被检测 | 自研 | 绿色色相 + 饱和度的启发式算法 |
| 区域感知混合 | 自研 | 人物区域 100% 强度，天空 70%，植被 80%，背景 85% 的分层混合 |
| 快速推理优化 | 自研 | 在 256px 缩略图上做语义检测，然后双线性上采样到全分辨率（节省 100-200ms） |

### 1.3 皮肤保护系统（Skin Protection — 三层防护）

这是完全**自研的核心差异化技术**：

| 层级 | 功能 | 参数 |
|------|------|------|
| Layer 1 | 色度迁移衰减 | 皮肤区域色度（a/b 通道）迁移强度降低 70% |
| Layer 2 | 单通道漂移硬限制 | a 通道最大偏移 ±12，b 通道最大偏移 ±14 |
| Layer 3 | 原始肤色软锚定 | 40% 的力度拉回原始皮肤色度值 |
| L 通道 | 亮度保护 | 皮肤区域亮度偏移衰减 25% |

**用大白话说：** 当你把一张人像照的色调改成电影感冷调时，人的皮肤不会变成蓝色或绿色——我们的算法会自动保护肤色的自然感。

### 1.4 胶片预设系统（Film Emulation Presets）

- **12 个预设**（Fuji × 7, Kodak × 4, Polaroid × 1）
- 每个预设是一个 `.cube` 格式的 3D LUT 文件
- LUT 文件由我们**根据真实胶片特征曲线自行制作**
- 支持用户从任意色彩迁移结果导出自定义 `.cube` LUT

### 1.5 专业编辑工具

| 工具 | 实现方式 |
|------|---------|
| 曲线编辑器（RGB/R/G/B） | 单调三次 Hermite 样条插值，256 级 LUT |
| HSL 7 轴面板 | 红/橙/黄/绿/青/蓝/紫独立色相/饱和度/亮度 |
| 曝光/对比度/高光/阴影 | 像素级实时处理 |
| Web Worker 离屏渲染 | OffscreenCanvas + Worker 线程，不阻塞 UI |

### 1.6 架构特点

| 特性 | 说明 |
|------|------|
| 纯客户端计算 | 所有图像处理在用户浏览器中完成，图片不上传服务器 |
| PWA | 支持离线使用、添加到主屏幕 |
| IndexedDB 存储 | LUT 预设和参考图片缓存在本地 |
| 隐私保护 | 用户照片完全不经过服务器 |

---

## 二、面对入境处的正确表述

### ❌ 不要说的（虚假）

- ~~"我们自己训练了一个 AI 模型"~~（你们没有从零训练任何 ML 模型）
- ~~"我们开发了自己的神经网络"~~（语义分割用的是 Google 开源模型）
- ~~"50+ 个预设"~~（实际是 12 个）

### ✅ 应该说的（真实且有说服力）

> "We built a **client-side AI color grading engine** that combines:
>
> 1. **A proprietary color transfer pipeline** based on the Reinhard algorithm, enhanced with our own chroma histogram matching, cinematic tone mapping, and Auto-XY strength recommendation system.
>
> 2. **A semantic-aware image processing system** that integrates Google's open-source MediaPipe segmentation models with our **custom-built skin protection algorithm** — a 3-layer chroma/luminance drift control system designed to prevent unnatural skin color shifts during color grading.
>
> 3. **12 hand-crafted film emulation presets** (Fuji/Kodak/Polaroid) in industry-standard 3D LUT format.
>
> 4. **Professional editing tools** including RGB curves editor and 7-axis HSL panel, all running in real-time in the browser.
>
> All image processing happens **entirely on the user's device** — no photos are uploaded to servers, which gives us a strong privacy advantage. The application is a Progressive Web App that works offline, requiring no app store downloads."

### 中文版本（入境处普通话面谈用）

> "我们开发了一个**客户端运行的 AI 调色引擎**。核心色彩迁移算法基于学术论文（Reinhard 2001），但我们在此基础上做了大量自研工作：
>
> 1. **色度直方图匹配**和**电影感色调增强**——让色彩迁移效果更接近专业调色师的水准
> 2. **三层皮肤保护算法**——这是我们的核心差异化技术，解决了行业痛点：当你改变照片整体色调时，人物肤色不会失真
> 3. **语义感知区域混合**——我们集成了 Google 的开源分割模型，结合自研的天空/植被/皮肤检测算法，对不同区域施加不同强度的色彩迁移
> 4. **12 个胶片模拟预设**，基于真实胶片特征曲线手工制作
>
> 所有图像处理在用户浏览器端完成，照片不会上传到我们的服务器。这既保护用户隐私，也大幅降低了我们的运营成本。"

---


## 三、社交媒体文案

> **写作原则：** 个人号发帖，不是品牌推广。说人话，别用模板，别堆 emoji。
> 小红书和 X 各一篇。
>
> **避免的 AI 味特征：**
> - ❌ 每行一个 emoji 打头的排比列表
> - ❌ "简单说就是" "而且这个东西" "其实就是想给" 这类万能桥接句
> - ❌ 假谦虚（"花了我好多时间😂"）和假松弛（"随便试~"）
> - ❌ 不自信的描述（"技术上大概是"）—— 是你做的就说清楚
> - ❌ 过度解释（"听起来复杂，用起来就是点一下"）

---

### 📕 小红书文案（中文）

**标题：** 因为喜欢摄影，自己做了一个调色工具

> **配图建议：** 第一条帖子建议发图片，6-9 张。封面用效果反差最大的 Before→After 对比拼图。

**正文：**

分享一下最近在做的一个东西。

我平时喜欢摄影，调色这件事一直困扰我——大多数时候都是凭感觉在调，没有一个体系化的思路。看到一张喜欢的电影截图或者别人的照片，想复刻那个色调，要么不知道从哪调起，要么调出来怎么都不对。

后来我就想，与其每次手动去猜参数，不如做一个工具，直接用一张参考图把色调"迁移"过来。

这就是 Kinolu，一个在线的色彩迁移和调色工具。

用法很直接：上传你的照片，再上传一张你想要的色调参考（电影截图、胶片照、别人的成片都行），算法会自动完成色彩迁移。也内置了 12 个经典胶片预设，富士 Provia、Velvia、Superia，柯达 Portra、Gold、Ektar，还有宝丽来，可以直接用。后续还会继续加更多的胶片预设进去。

技术上是基于 LAB 色彩空间的统计匹配算法，加上了语义分割（区分人物、天空、植被，不同区域用不同迁移强度）、电影感色调增强、以及一套皮肤保护机制——调完色之后人脸不会偏色。

不需要下载 app，浏览器打开 kinolu.cam 就能用。iPhone、安卓、电脑都支持。安卓和电脑浏览器会直接提示安装，iPhone 的话点底部分享按钮选「添加到主屏幕」就行，装好后像普通 app 一样从桌面打开，自动更新。所有图像处理都在本地完成，照片不会上传到服务器。

做这个的出发点主要是面向喜欢摄影、但不想花大量时间去学专业修图软件的人。很多摄影爱好者对画面构图和拍摄本身很有想法，但调色这块确实需要比较专业的色彩知识，门槛不低。Kinolu 想做的就是把这个门槛降下来，让你能快速得到自己想要的色调效果。

目前还在持续迭代中，色彩迁移的质量和整体体验还有不少可以优化的地方。如果你试用之后有任何反馈，非常欢迎告诉我，后续会根据大家的意见继续改进。

→ kinolu.cam

#摄影 #调色 #胶片感 #电影感调色 #色彩迁移 #Kinolu #修图 #Vlog调色 #手机摄影

---

### 🐦 X (Twitter) 文案（英文） — Thread 格式

> **发布方式：** 发第 1 条后，依次回复自己，形成 Thread。
> **第 1 条带 4 张图：** 选 2 组效果最好的 Before→After 对比（4 张图刚好）。

**1/5** [附 4 张图]

I like photography but always sucked at color grading — just guessing with sliders.

So I built Kinolu. Give it a reference photo (movie still, film shot, whatever) and your photo, it matches the color grade automatically.

https://www.kinolu.cam/?utm_source=twitter&utm_medium=social&utm_campaign=launch

**2/5**

How it works: LAB color space statistical matching + semantic segmentation. It detects skin, sky, vegetation and applies different transfer intensities to each region.

Has a 3-layer skin protection system — faces don't turn blue when you go full cold cinematic.

**3/5**

12 built-in film presets — Fuji Provia, Velvia, Superia, Kodak Portra, Gold, Ektar, Polaroid. More coming.

You can also export any color transfer result as a .cube 3D LUT file.

**4/5**

Runs entirely in the browser. No app to download. iPhone, Android, desktop.

All processing happens on your device — photos never leave it. Tap share → "Add to Home Screen" and it works like a native app. Works offline too.

**5/5**

Built this for people who enjoy photography but don't want to spend hours learning pro editing software. You know how to frame a good shot — you just want the colors right.

Still a work in progress. Feedback welcome, will keep iterating.

https://www.kinolu.cam/?utm_source=twitter&utm_medium=social&utm_campaign=launch

---

> **Threads 文案：** 直接把上面 5 条合并发一条即可（Threads 支持 500 字符，格式更自由）。内容一样，不用另写。

---

## 四、核心定位 — 一句话说清楚

| 场景 | 一句话 |
|------|--------|
| 入境处（英文） | "Kinolu is an AI-powered photo color grading tool that runs entirely in the browser, with proprietary skin protection technology." |
| 入境处（中文） | "Kinolu 是一个浏览器端运行的 AI 照片调色工具，拥有自研的皮肤保护算法。" |
| 小红书 | "自己爱拍照，做了个一键复刻色调的工具，免下载添加到主屏幕就能用" |
| Twitter | "I like photos but suck at color grading, so I built a tool that steals any color grade in one click — runs in your browser, add to home screen." |
| 投资人 | "Client-side AI color grading with semantic-aware skin protection — zero server cost, full privacy." |

---

## 五、技术诚信红线

### 可以说 ✅
- "自研的皮肤保护算法" — ✅ 真实，三层系统是完全原创的
- "自研的电影感色调增强" — ✅ 真实，S 曲线 + 自适应映射是原创的
- "自研的色度直方图匹配" — ✅ 真实，CDF 匹配代码是原创的
- "自研的 Auto XY 推荐系统" — ✅ 真实，连续函数算法是原创的
- "基于学术论文的色彩迁移" — ✅ 真实且诚实
- "集成 Google 开源模型做语义分割" — ✅ 真实且诚实
- "所有处理在用户设备端完成" — ✅ 真实
- "12 个手工制作的胶片预设" — ✅ 真实

### 不能说 ❌
- "自己训练的 AI 模型" — ❌ 你用的是 Google 预训练的 MediaPipe 模型
- "自主研发的深度学习框架" — ❌ 没有用自训练的神经网络
- "50+ 预设" — ❌ 实际是 12 个
- "零延迟" — ❌ 有处理时间，只是很快

### 灰色地带（建议怎么说）
- "AI 调色" — ✅ 可以说。语义分割是 AI 模型，色彩迁移算法虽然不是深度学习但属于计算智能
- "AI-powered" — ✅ 可以说。MediaPipe 模型确实是 AI，且是核心流程的一部分
- "自研引擎" — ✅ 可以说。虽然基础算法来自论文，但整个处理 pipeline（LUT 构建、直方图匹配、电影感增强、皮肤保护、区域混合）都是你们写的
