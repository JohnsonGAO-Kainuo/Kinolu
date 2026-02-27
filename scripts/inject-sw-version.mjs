#!/usr/bin/env node
/**
 * Injects a build-time version into sw.js so the service worker cache
 * is automatically busted on every deployment.
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const swPath = resolve(__dirname, "../public/sw.js");

const buildHash = Date.now().toString(36); // compact timestamp
const sw = readFileSync(swPath, "utf-8");

const updated = sw.replace(
  /const CACHE_NAME = "kinolu-[^"]*";/,
  `const CACHE_NAME = "kinolu-${buildHash}";`
);

writeFileSync(swPath, updated, "utf-8");
console.log(`✓ SW cache version → kinolu-${buildHash}`);
