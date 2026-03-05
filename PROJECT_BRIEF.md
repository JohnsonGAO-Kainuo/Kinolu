# Kinolu — Project Brief for AI Assistant Context

> **Last updated:** 2026-02-28
> **GitHub:** JohnsonGAO-Kainuo/Kinolu.git
> **Production:** https://kinolu.cam (Vercel)

---

## 1. What is Kinolu?

Kinolu is a **mobile-first PWA** (Progressive Web App) for photo color grading / color transfer. Think of it as a simpler, sleeker alternative to ColorBy — users upload a photo, pick a reference image or film preset, and Kinolu transfers the color palette onto their photo. It also includes a Lightroom-style editor with curves, HSL, crop, and other adjustments.

### Core User Flow
1. **Import** a source photo
2. **Add** a reference image (whose colors you want to match)
3. Kinolu **auto-applies** the color transfer (no Apply button needed — just tap a ref)
4. Fine-tune with **XY pad** (color/tone strength) or **edit tools** (light, color, effects, detail, curves, HSL, crop)
5. **Save** as a preset, **export** as .cube LUT, or **download/share** the result
6. Optional: **batch process** multiple photos with the same look (Pro only)

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | **Next.js 16.1.6** (App Router, Turbopack) |
| UI | **React 19.2.3** + **Tailwind CSS v4** |
| Language | **TypeScript** (strict) |
| Auth | **Supabase** (email/password, auth.users → profiles table) |
| Payments | **Stripe** (Payment Links, no webhooks yet ⚠️) |
| Database | **Supabase PostgreSQL** (profiles, subscriptions, feedback tables) |
| Storage | **IndexedDB** (LUTs, ref images — all client-side) |
| Backend | **Python FastAPI** (optional, local only — for advanced color transfer via `/api/*` proxy) |
| Deploy | **Vercel** (Next.js only; Python backend is local-only) |
| PWA | Service worker + manifest.json, installable on iOS/Android |

---

## 3. Project Structure

```
Kinolu/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── layout.tsx          # Root layout (AuthProvider, I18nProvider, BuiltinLutsInit)
│   │   ├── page.tsx            # Home page
│   │   ├── error.tsx           # Error boundary
│   │   ├── globals.css         # Global styles + Tailwind + safe areas
│   │   ├── auth/
│   │   │   ├── callback/route.ts  # Supabase auth code exchange
│   │   │   ├── login/page.tsx     # Login
│   │   │   └── register/page.tsx  # Registration + email confirmation
│   │   ├── camera/page.tsx     # Live camera with LUT preview
│   │   ├── editor/page.tsx     # ★ MAIN EDITOR (~1120 lines)
│   │   ├── feedback/page.tsx   # Feedback form (→ Supabase)
│   │   ├── presets/page.tsx    # Preset/LUT library
│   │   ├── privacy/page.tsx    # Privacy policy
│   │   ├── profile/page.tsx    # User profile
│   │   ├── subscription/page.tsx  # Stripe subscription plans
│   │   └── terms/page.tsx      # Terms of service
│   ├── components/
│   │   ├── AuthProvider.tsx    # Supabase auth context (useAuth hook)
│   │   ├── BuiltinLutsInit.tsx # One-shot LUT installer (12 builtin film LUTs)
│   │   ├── CropOverlay.tsx     # Crop UI overlay
│   │   ├── CurveEditor.tsx     # Curves adjustment (canvas)
│   │   ├── EditorTabBar.tsx    # Transfer/Edit bottom tab bar
│   │   ├── HSLPanel.tsx        # HSL 7-band adjustment
│   │   ├── Sidebar.tsx         # Navigation drawer
│   │   ├── XYPad.tsx           # 2D pad for color/tone transfer strength
│   │   ├── AdjustmentPanel.tsx # Slider-based adjustments
│   │   └── icons.tsx           # All SVG icons centralized
│   └── lib/
│       ├── api.ts              # API client (server + client-side fallback)
│       ├── builtinLuts.ts      # 12 builtin LUT manifest + installer
│       ├── colorTransfer.ts    # Client-side color transfer (Reinhard LAB)
│       ├── imageProcessor.ts   # Canvas-based image processing
│       ├── lutStore.ts         # IndexedDB LUT storage
│       ├── refStore.ts         # IndexedDB reference image storage
│       ├── segmentation.ts     # MediaPipe/SAM segmentation
│       ├── types.ts            # TypeScript type definitions
│       ├── usePWAInstall.ts    # PWA install prompt hook
│       ├── i18n/
│       │   ├── index.tsx       # I18n provider + useI18n hook
│       │   └── locales/        # en.ts, zh-CN.ts, zh-TW.ts
│       └── supabase/
│           ├── client.ts       # Browser Supabase client
│           └── types.ts        # Profile + Subscription types
├── public/
│   ├── luts/                   # 12 builtin .cube LUT files + sample.jpg
│   ├── icons/                  # PWA icons
│   ├── manifest.json           # PWA manifest
│   └── sw.js                   # Service worker
├── backend/                    # Python FastAPI (local dev only)
├── third_party/color_transfer/ # Python color transfer lib
├── tools/                      # Python dev utility scripts
├── archive/                    # Archived old files (gitignored)
└── [config files]              # next.config.ts, tsconfig.json, package.json, etc.
```

---

## 4. Key Concepts

### 4.1 Editor Tabs
- **Transfer tab**: Upload source → add ref → auto-apply color transfer → XY pad fine-tune
- **Edit tab**: Lightroom-style sub-tabs (Light, Color, Effects, Detail, Curves, HSL, Crop)

### 4.2 LUT System
- **12 builtin film LUTs** stored in IndexedDB (LS_KEY = `kinolu_builtin_luts_v6`)
- Categories: Fuji (Pro 160C, Pro 400H, Superia 400, C200, Velvia), Kodak (Portra 400, Ektar, Gold 200, UltraMax), Cinematic (Chrome, Noir, Bleach Bypass)
- Free users get 5; Pro users get 12+ (and growing)
- Users can also import .cube LUT files

### 4.3 XY Pad
- ColorBy-inspired 2D control pad
- X-axis: Color transfer strength (0-1)
- Y-axis: Tone/brightness transfer strength (0-1)
- Has a `?` button that toggles axis labels on/off
- Warm red-pink gradient background, 8×8 dot grid

### 4.4 Batch Processing (Pro only)
- Multi-file import: select multiple files → first = source, rest = batch queue
- ColorBy-style top strip shows batch thumbnails with status indicators
- "Apply All" processes all batch files with the same reference/settings

---

## 5. Free vs Pro Features

| Feature | Free | Pro |
|---------|------|-----|
| Color transfer | 5 photos/day | ∞ |
| Film presets | 5 | 12+ |
| User presets | Max 5 | ∞ |
| Camera & viewfinder | ✓ | ✓ |
| Photo editor | ✓ | ✓ |
| LUT import/export | ✓ | ✓ |
| Batch processing | — | ✓ |
| Cloud sync | — | Coming soon |

### Enforcement Points
- **Daily transfer limit**: Client-side localStorage counter in `runTransfer()` (editor/page.tsx)
- **Film preset lock**: `getBuiltinMeta(name).isFree` check in `applyLutInline()` + camera page
- **User preset limit**: 5 max check in `handleSavePreset()` + `onImportLocal()` (presets page)
- **Batch gating**: `isPro` check in `handleSourceUpload()` multi-file handler

---

## 6. Supabase Configuration

- **Project ID:** `bukyxpxhynorcuxfsjlz`
- **URL:** `https://bukyxpxhynorcuxfsjlz.supabase.co`

### Database Tables
1. **profiles** — `id` (uuid, FK→auth.users), email, display_name, subscription_tier ('free'/'pro'), stripe_customer_id, daily_transfer_count, daily_transfer_reset_at
2. **subscriptions** — id, user_id (FK→profiles), stripe_subscription_id, stripe_price_id, plan_type, status, period dates
3. **feedback** — id, user_id (nullable), email, message, created_at

### Auth Flow
- Email/password signup → email confirmation → callback route exchanges code for session
- `useAuth()` hook provides: user, session, profile, subscription, isPro, signUp, signIn, signOut, refreshProfile
- `isPro` = `profile.subscription_tier === 'pro'`

---

## 7. Stripe Configuration

- **Account:** `acct_1SeyYoJTqJOgtjP4`
- **Product:** Kinolu Pro (`prod_U35UTwnhTYPkFg`)
- **Prices (multi-currency: USD + HKD):**
  - Monthly: `price_1T7c2NJTqJOgtjP4Z6YCIFDh` ($2.99/mo, HK$23/mo)
  - Annual: `price_1T7c2OJTqJOgtjP4OJL6hciI` ($29.99/yr, HK$233/yr)
  - Lifetime: `price_1T7c2NJTqJOgtjP4eFKAoT3X` ($49.99 one-time, HK$388)
- **Payment Links:** Configured via `NEXT_PUBLIC_STRIPE_LINK_*` env vars (auto-select currency by IP)
- **Webhook:** Supabase Edge Function `stripe-webhook` (v9) — handles checkout, subscription lifecycle, invoices

---

## 8. i18n

- Three languages: English (`en`), Simplified Chinese (`zh-CN`), Traditional Chinese (`zh-TW`)
- TypeScript-enforced completeness: zh-CN and zh-TW are typed as `Record<keyof typeof en, string>`, so missing keys cause compile errors
- Auto-detect from browser language, stored in localStorage

---

## 9. Known TODOs / Issues

### 🔴 Critical
1. **Stripe webhook needed** — Users pay but `subscription_tier` is never updated to `'pro'` in DB. Need a Supabase Edge Function or API route to handle `checkout.session.completed`.

### 🟡 Should Fix
2. **PWA manifest** missing `maskable` icon for Android adaptive icons
3. **Service worker** cache version hardcoded as `kinolu-v1` — should bump on deploys
4. **Daily transfer limit** is client-side only (localStorage) — can be bypassed. Server-side enforcement would be more robust but requires the Python backend.

### 💡 Future
5. Cloud sync (presets, ref images)
6. Server-side Stripe subscription verification
7. Push notifications for subscription expiry

---

## 10. Development Commands

```bash
# Install dependencies
npm install

# Dev server (Next.js only — color transfer uses client-side fallback)
npm run dev

# Full stack (Next.js + Python backend for advanced transfer)
./start.sh

# Build for production
npx next build

# Deploy (auto via Vercel on git push)
git push origin main
```

---

## 11. Environment Variables (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=https://bukyxpxhynorcuxfsjlz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
NEXT_PUBLIC_STRIPE_LINK_MONTHLY=https://buy.stripe.com/...
NEXT_PUBLIC_STRIPE_LINK_ANNUAL=https://buy.stripe.com/...
NEXT_PUBLIC_STRIPE_LINK_LIFETIME=https://buy.stripe.com/...
```

---

## 12. Design Language

- **Dark theme only** — pure black (#000000) background
- **Typography:** System font, tracking-heavy uppercase labels, small sizes (9-14px)
- **Corners:** Rounded (xl for panels, full for pills)
- **Opacity-based hierarchy:** white/80 → white/60 → white/40 → white/30 → white/20
- **No emoji in UI** — all icons are custom SVG components in `icons.tsx`
- **Mobile-first:** Designed for iPhone PWA, 100vh layout, safe-area handling
- **Reference apps:** ColorBy (batch UI, XY pad), Kumo (editing layout), VSCO (overall aesthetic)
