# Kinolu Frontend Interaction Spec (Mobile-First PWA)

## 1. Purpose

This document defines the real frontend interaction logic for the next phase:

- Keep current "reference -> transfer -> export" flow.
- Add camera capture flow for mobile users.
- Add preset ecosystem (save/import/use/export).
- Keep decision cost low: one main path, minimal visible toggles.

This spec is implementation-facing (product + frontend + backend alignment).

## 2. Product Principles

- Minimal decisions: users should not choose algorithms.
- Fast feedback: first preview in <= 3 seconds for mobile-sized images.
- Mobile first: PWA is primary, desktop is compatible.
- Preset-first workflow: every output can become a reusable preset.
- Cinematic identity: visual language and interactions should feel film-camera oriented.

## 2.1 Visual Baseline (Locked)

- Primary visual baseline: Figma `Camera Screen (Community)` node `3:38`.
- Interaction references: local `ref/colorby/*` and `ref/kumo/*`.
- Reused signature component: bottom 3-button capsule nav (left/library, center/main action, right/settings).
- Main UI bans: algorithm dropdown, Skin Protection toggle, Cinematic toggle.
- Icon policy: no emoji; use consistent SVG-style icon language.

## 3. Scope

## 3.1 In Scope (Next Build)

- Single visible transfer pipeline (`reinhard_lab` + built-in cinematic enhancement).
- Two-dimensional XY strength control:
  - X = color imitation strength
  - Y = tone imitation strength
- Camera capture entry in PWA.
- Save current look as platform preset.
- Import `.cube` preset to platform library.
- Batch import multiple targets and apply one reference/preset consistently.
- Export outputs: JPG (free) + `.cube/.xmp/.dng` (Pro).

## 3.2 Out of Scope (Later)

- Multi-algorithm user selection UI.
- Complex pro color grading panel as default.
- Full desktop-native app.

## 4. Primary User Flows

## 4.0 Entry Flow (Single Product, Dual Entry)

Home is one screen with two primary actions, not two separate apps:

1. `Shoot` (left primary button):
   - opens camera capture flow directly.
2. `Edit` (right primary button):
   - opens reference + target color transfer flow.

Design intent:
- Keep first decision minimal (only two choices).
- Keep both flows in one shared preset/export ecosystem.
- Do not expose algorithm or technical settings here.

## 4.1 Flow A: Photo-to-Photo Transfer (Current Core)

1. User selects reference image.
2. User selects target image.
3. User taps `Generate`.
4. System returns preview and auto-places XY point.
5. User drags XY pad for adjustment.
6. User exports JPG or saves as preset.

## 4.2 Flow B: Camera Capture -> Apply Style

1. User taps `Camera`.
2. App opens camera viewfinder (PWA media API).
3. User captures photo.
4. Captured photo becomes target image.
5. User chooses reference/preset and taps `Generate`.
6. User fine-tunes XY and saves/exports.

## 4.3 Flow C: Preset Ecosystem

1. User generates a result.
2. User taps `Save Preset`.
3. Enters preset name + optional tags.
4. Preset is saved to user library (with metadata and preview).
5. Later user applies this preset to new photos or camera captures.

## 4.4 Flow D: Import `.cube`

1. User enters `Preset Library`.
2. Taps `Import CUBE`.
3. Uploads `.cube` file.
4. System validates file and generates preview LUT thumbnail.
5. Preset stored in personal library.

## 4.5 Flow E: Batch Import -> Batch Generate

1. User enters batch import mode.
2. Selects one reference image (or one preset).
3. Imports multiple target images.
4. Optionally applies shared XY and cinematic values.
5. Starts batch generation queue.
6. Reviews per-item status and exports selected/all results.

## 5. Screen Map

- `S1 Home (Dual Entry)`
  - Primary left: `Shoot`
  - Primary right: `Edit`
  - Secondary: batch import / presets / quota / upgrade
- `S2 Create/Edit`
  - Reference picker
  - Target picker
  - Generate button
- `S3 Result`
  - Preview area
  - XY pad
  - Show Original
  - Save Preset
  - Export
- `S4 Preset Library`
  - My presets
  - Film packs
  - Import CUBE
- `S5 Camera`
  - Live preview
  - Shutter
  - Use photo / Retake
- `S6 Export Sheet`
  - JPG
  - CUBE / XMP / DNG (Pro lock if needed)
- `S7 Batch Import`
  - Multi-file intake
  - Queue and progress
  - Retry failed
- `S8 Editing Panel`
  - Collapsible groups
  - RGB curve + HSL 7-way + film finish

## 6. Core UI Components

## 6.1 XY Pad (Primary Control)

- Kumo-like interaction: center-biased joystick style XY.
- Auto-XY enabled by default after generation.
- Manual input remains available behind "advanced" affordance.
- Range: `0-100` for both axes.
- Include:
  - dead zone at center for "neutral carry-over"
  - soft snap on key points (25/50/75)
  - quadrant hint labels for creative direction
  - live numeric readout near control

## 6.2 Cinematic Strength

- Keep one slider visible (built-in cinematic character).
- Default value: `72`.
- No cinematic on/off toggle in main flow.
- No skin-protection toggle in main flow.

## 6.3 Preset Card

- Thumbnail
- Name
- Source type (`generated` / `imported cube`)
- Last used time
- Quick actions: `Apply`, `Rename`, `Delete`, `Export`

## 6.4 Batch Import Manager

- Intake:
  - drag-drop + multi-file picker
  - quick duplicate filtering (same filename+size warning)
- Queue row:
  - thumbnail, filename, resolution, status, retry button
- Actions:
  - `Start Batch`, `Pause`, `Cancel`, `Retry Failed`, `Download All`
- Limits (initial):
  - max 20 images per batch (configurable)
  - mobile default cap 10 images

## 6.5 Editing Panel (Complete but layered)

- Group A: Tone
  - exposure, contrast, highlights, shadows
- Group B: Color
  - temperature, tint, saturation, vibrance
- Group C: Curves
  - RGB channel tabs with draggable points
- Group D: HSL 7-way
  - red/orange/yellow/green/aqua/blue/purple, each H/S/L
- Group E: Film Finish
  - grain, vignette, bloom/halation
- UX rule:
  - groups collapsed by default
  - preserve last-opened group per user

## 6.6 Vintage System (explicit)

- Preset families:
  - `Vintage Warm Gold` (Kodak-like direction)
  - `Vintage Soft Green` (Fuji-like direction)
  - `Neutral Matte Film`
- Each family stores:
  - tone curve signature
  - color bias
  - grain/halation recommendation
  - scene suitability tags
- All naming uses "like/direction" wording to avoid trademark misuse.

## 7. State Machine (Frontend)

- `idle`: waiting for images
- `ready`: reference + target selected
- `processing`: request sent, controls disabled
- `done`: result rendered, actions enabled
- `error`: error message + retry

Transitions:

- `idle -> ready`: both images available
- `ready -> processing`: user taps generate
- `processing -> done`: API success
- `processing -> error`: API failure/timeout
- `error -> processing`: retry

## 8. API Contract Alignment

## 8.1 Existing Endpoints (Already in repo)

- `POST /api/transfer`
- `GET /api/capabilities`
- `GET /api/health`

## 8.2 New Endpoints (Required for next phase)

- `POST /api/presets` (save generated preset)
- `GET /api/presets` (list user presets)
- `PATCH /api/presets/{id}` (rename/tag)
- `DELETE /api/presets/{id}`
- `POST /api/presets/import-cube`
- `POST /api/camera/capture` (optional server-side ingest, if needed)
- `POST /api/transfer/batch` (submit batch generation job)
- `GET /api/jobs/{id}` (batch progress polling)
- `POST /api/jobs/{id}/retry-failed`
- `POST /api/jobs/{id}/cancel`

## 9. Mobile PWA Requirements

- Manifest:
  - installable
  - app icon set
  - standalone display mode
- Service Worker:
  - static asset cache
  - offline shell
  - retry queue for failed uploads (optional phase 2)
- Media:
  - camera permission request flow
  - graceful fallback to file upload
- Performance:
  - webp/jpeg preview compression before upload
  - avoid blocking UI during processing

## 10. UX Copy (Suggested)

- Generate button: `Generate Look`
- Save preset: `Save to My Presets`
- Camera CTA: `Shoot`
- Import: `Import CUBE`
- Empty state: `No presets yet. Save your first look.`

## 11. Analytics Events

- `generate_clicked`
- `generate_succeeded`
- `generate_failed`
- `xy_adjusted`
- `preset_saved`
- `preset_imported_cube`
- `export_clicked`
- `camera_opened`
- `camera_capture_confirmed`

## 12. Acceptance Criteria (Next Phase)

- User can complete create->preview->save preset in <= 4 taps after image selection.
- User can import `.cube` and apply it to a new target.
- User can run batch import (>=10 images) with visible queue progress and retries.
- PWA on iOS/Android can open camera and capture target image.
- Export sheet correctly gates Pro formats.
- No algorithm selection is exposed in main UI.
