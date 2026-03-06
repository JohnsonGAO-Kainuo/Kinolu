# Kinolu

> **Production:** [kinolu.cam](https://kinolu.cam) · **Deploy:** Vercel (auto on push)

A mobile-first PWA for photo color grading and color transfer. Upload a photo, pick a reference image or film preset, and Kinolu transfers the color palette — all in the browser, no server required.

## Features

- **Color Transfer** — Reinhard LAB algorithm with automatic XY strength recommendation
- **XY Pad** — 2D control for color (chroma) and tone (luminance) blend strength
- **Film Presets** — 12 built-in film emulation LUTs (Fuji, Kodak, Cinematic)
- **Photo Editor** — Light, Color, Effects, Detail, Curves (RGBM), HSL (7-band)
- **Segmentation** — MediaPipe person/face detection for skin protection and region-aware blending
- **Camera** — Live viewfinder with real-time LUT preview
- **Batch Processing** — Process multiple photos with the same look (Pro)
- **LUT Import/Export** — Import `.cube` files, export your looks as `.cube`
- **PWA** — Installable on iOS/Android, works offline

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19 + Tailwind CSS v4 |
| Language | TypeScript (strict) |
| Auth | Supabase (email/password) |
| Payments | Stripe (Payment Links + webhook) |
| Database | Supabase PostgreSQL |
| Storage | IndexedDB (LUTs, ref images — client-side) |
| Deploy | Vercel |
| PWA | Service worker + manifest.json |

## Architecture

All image processing runs **entirely in the browser** — no backend server needed:

- `src/lib/colorTransfer.ts` — Reinhard LAB color transfer + 33³ LUT generation
- `src/lib/segmentation.ts` — MediaPipe person/face segmentation + heuristic masks
- `src/lib/imageProcessor.ts` — 13-stage real-time edit pipeline (Web Worker)
- `src/lib/lutStore.ts` — IndexedDB LUT storage + trilinear interpolation

Stripe webhook processing runs as a Supabase Edge Function (`supabase/functions/stripe-webhook/`).

## Development

```bash
# Install
npm install

# Dev server
npm run dev
# → http://localhost:3000

# Production build
npx next build

# Deploy (auto via Vercel on push)
git push origin main
```

## Environment Variables

Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=<your supabase url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon key>
NEXT_PUBLIC_STRIPE_LINK_MONTHLY=<stripe payment link>
NEXT_PUBLIC_STRIPE_LINK_ANNUAL=<stripe payment link>
NEXT_PUBLIC_STRIPE_LINK_LIFETIME=<stripe payment link>
```

## Project Structure

```
src/
├── app/           # Next.js pages (editor, camera, presets, auth, etc.)
├── components/    # React components (XYPad, CurveEditor, HSLPanel, etc.)
└── lib/           # Core logic (color transfer, segmentation, LUT store, i18n)
public/
├── luts/          # 12 built-in .cube LUT files
├── heroes/        # Homepage images
├── icons/         # PWA icons
└── sw.js          # Service worker
scripts/           # Build scripts (SW version injection)
supabase/          # Edge Functions (Stripe webhook, portal session)
```

## i18n

Three languages: English, 简体中文, 繁體中文. Auto-detected from browser, stored in localStorage.

## License

All rights reserved. See source code for details.
