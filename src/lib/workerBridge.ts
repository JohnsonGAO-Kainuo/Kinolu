/**
 * Worker bridge — thin wrapper around the image-processor Web Worker.
 * Falls back gracefully to main-thread processing if Workers unavailable.
 *
 * Usage:
 *   const result = await workerApplyEdits(imageData, params, liveMode);
 *   const result = await workerApplyLut(imageData, lutData, lutSize);
 */

import type { EditParams } from "./types";

let _worker: Worker | null = null;
let _workerFailed = false;
let _idCounter = 0;
const _pending = new Map<number, {
  resolve: (data: ImageData) => void;
  reject: (err: Error) => void;
}>();

function getWorker(): Worker | null {
  if (_workerFailed) return null;
  if (_worker) return _worker;
  try {
    _worker = new Worker("/image-processor.worker.js");
    _worker.onmessage = (e) => {
      const { id, buffer, width, height } = e.data;
      const cb = _pending.get(id);
      if (cb) {
        _pending.delete(id);
        const arr = new Uint8ClampedArray(buffer);
        cb.resolve(new ImageData(arr, width, height));
      }
    };
    _worker.onerror = () => {
      _workerFailed = true;
      _worker = null;
      // Reject all pending
      for (const [, cb] of _pending) cb.reject(new Error("Worker crashed"));
      _pending.clear();
    };
    return _worker;
  } catch {
    _workerFailed = true;
    return null;
  }
}

/**
 * Apply edits via Web Worker (zero-copy transfer).
 * Falls back to main-thread `applyEdits` if worker unavailable.
 */
export function workerApplyEdits(
  source: ImageData,
  params: EditParams,
  liveMode = false,
): Promise<ImageData> {
  const w = getWorker();
  if (!w) {
    // Fallback: dynamic import main-thread version
    return import("./imageProcessor").then(({ applyEdits }) =>
      applyEdits(source, params, liveMode)
    );
  }

  return new Promise((resolve, reject) => {
    const id = ++_idCounter;
    _pending.set(id, { resolve, reject });

    // Copy buffer so we don't transfer the source
    const copy = new Uint8ClampedArray(source.data);
    w.postMessage(
      {
        type: "applyEdits",
        id,
        buffer: copy.buffer,
        width: source.width,
        height: source.height,
        params,
        liveMode,
      },
      [copy.buffer],
    );
  });
}

/**
 * Apply LUT via Web Worker (zero-copy transfer).
 * Falls back to main-thread if worker unavailable.
 */
export function workerApplyLut(
  source: ImageData,
  lutData: Float32Array,
  lutSize: number,
): Promise<ImageData> {
  const w = getWorker();
  if (!w) {
    return import("./lutStore").then(({ applyLutToPixels }) => {
      const copy = new Uint8ClampedArray(source.data);
      applyLutToPixels(copy, lutData, lutSize);
      return new ImageData(copy, source.width, source.height);
    });
  }

  return new Promise((resolve, reject) => {
    const id = ++_idCounter;
    _pending.set(id, { resolve, reject });

    const pxCopy = new Uint8ClampedArray(source.data);
    const lutCopy = new Float32Array(lutData);
    w.postMessage(
      {
        type: "applyLut",
        id,
        buffer: pxCopy.buffer,
        lutBuffer: lutCopy.buffer,
        lutSize,
        width: source.width,
        height: source.height,
      },
      [pxCopy.buffer, lutCopy.buffer],
    );
  });
}

/** Pre-warm the worker so first edit doesn't pay init cost */
export function warmupWorker(): void {
  getWorker();
}
