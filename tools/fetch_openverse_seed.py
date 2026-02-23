#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import random
import re
import sys
import time
from pathlib import Path
from typing import Dict, Iterable, List, Optional
from urllib.parse import urlencode, urlparse

import requests

OPENVERSE_IMAGES_API = "https://api.openverse.org/v1/images/"
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

REFERENCE_QUERIES = [
    "cinematic street",
    "moody portrait",
    "film look landscape",
    "rainy street",
    "golden hour portrait",
    "vintage city",
    "teal orange city",
    "low key portrait",
]

TARGET_QUERIES = [
    "neutral portrait daylight",
    "flat lighting portrait",
    "overcast street scene",
    "neutral city architecture",
    "indoor room daylight",
    "daytime landscape neutral",
    "plain portrait",
    "neutral photo",
]

VALID_IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Fetch a permissive-license image seed set from Openverse and build a local evaluation manifest."
    )
    p.add_argument(
        "--out-root",
        default="archive/local_assets_20260213/datasets/openverse_seed",
        help="Output root directory",
    )
    p.add_argument("--reference-count", type=int, default=20, help="How many reference images to fetch")
    p.add_argument("--target-count", type=int, default=40, help="How many target images to fetch")
    p.add_argument("--pair-count", type=int, default=40, help="How many rows in manifest (reference-source pairs)")
    p.add_argument(
        "--licenses",
        default="cc0,pdm",
        help="Comma-separated Openverse license codes (e.g. cc0,pdm,by,by-sa)",
    )
    p.add_argument("--min-width", type=int, default=1024, help="Minimum accepted image width")
    p.add_argument("--min-height", type=int, default=768, help="Minimum accepted image height")
    p.add_argument("--pages-per-query", type=int, default=4, help="API pages fetched per query")
    p.add_argument("--page-size", type=int, default=20, help="Openverse page size (anonymous requests should stay <= 20)")
    p.add_argument("--request-sleep", type=float, default=0.35, help="Seconds to sleep between API requests")
    p.add_argument(
        "--sources",
        default="stocksnap",
        help="Comma-separated Openverse sources (e.g. stocksnap,flickr,wikimedia)",
    )
    p.add_argument(
        "--reference-queries-file",
        default="",
        help="Text file with one reference query per line (overrides built-in reference queries)",
    )
    p.add_argument(
        "--target-queries-file",
        default="",
        help="Text file with one target query per line (overrides built-in target queries)",
    )
    p.add_argument(
        "--exclude-keywords",
        default="illustration,painting,drawing,cartoon,anime,sketch,render,3d,vector",
        help="Drop items whose title contains these keywords (comma-separated)",
    )
    p.add_argument("--timeout", type=int, default=30, help="Network timeout seconds")
    p.add_argument("--seed", type=int, default=42, help="Random seed for pairing")
    return p.parse_args()


def _request_json(url: str, timeout: int) -> Dict:
    resp = requests.get(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json()


def _build_query_url(
    query: str,
    page: int,
    page_size: int,
    licenses: Iterable[str],
    sources: Iterable[str],
) -> str:
    params = [("q", query), ("page", str(page)), ("page_size", str(page_size))]
    for lic in licenses:
        params.append(("license", lic))
    for src in sources:
        params.append(("source", src))
    return f"{OPENVERSE_IMAGES_API}?{urlencode(params)}"


def _slug(text: str, max_len: int = 36) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    if not normalized:
        return "img"
    return normalized[:max_len].strip("-") or "img"


def _pick_suffix(url: str) -> str:
    path = urlparse(url).path.lower()
    for suffix in VALID_IMAGE_SUFFIXES:
        if path.endswith(suffix):
            return suffix
    return ".jpg"


def _to_candidate(
    result: Dict,
    query: str,
    allowed_licenses: set[str],
    min_width: int,
    min_height: int,
    exclude_keywords: set[str],
) -> Optional[Dict]:
    image_url = result.get("url")
    license_code = (result.get("license") or "").lower()
    width = int(result.get("width") or 0)
    height = int(result.get("height") or 0)
    title = (result.get("title") or "").strip()
    title_l = title.lower()

    if not image_url:
        return None
    if license_code not in allowed_licenses:
        return None
    if result.get("mature"):
        return None
    if width < min_width or height < min_height:
        return None
    if exclude_keywords and any(k in title_l for k in exclude_keywords):
        return None

    img_id = str(result.get("id") or f"{_slug(title or 'img')}-{width}x{height}")
    return {
        "id": img_id,
        "query": query,
        "title": title,
        "url": image_url,
        "creator": result.get("creator") or "",
        "creator_url": result.get("creator_url") or "",
        "license": license_code,
        "license_url": result.get("license_url") or "",
        "attribution": result.get("attribution") or "",
        "foreign_landing_url": result.get("foreign_landing_url") or "",
        "provider": result.get("provider") or "",
        "source": result.get("source") or "",
        "width": width,
        "height": height,
    }


def collect_candidates(
    queries: List[str],
    wanted_count: int,
    allowed_licenses: set[str],
    allowed_sources: set[str],
    min_width: int,
    min_height: int,
    exclude_keywords: set[str],
    pages_per_query: int,
    page_size: int,
    timeout: int,
    request_sleep: float,
) -> List[Dict]:
    picked: List[Dict] = []
    seen_urls: set[str] = set()

    for query in queries:
        for page in range(1, pages_per_query + 1):
            try:
                url = _build_query_url(
                    query=query,
                    page=page,
                    page_size=page_size,
                    licenses=sorted(allowed_licenses),
                    sources=sorted(allowed_sources),
                )
                payload = _request_json(url, timeout=timeout)
            except (requests.RequestException, json.JSONDecodeError, TimeoutError) as exc:
                print(f"[warn] query failed: '{query}' page {page}: {exc}", file=sys.stderr)
                if "429" in str(exc):
                    time.sleep(max(1.5, request_sleep * 5))
                else:
                    time.sleep(max(0.25, request_sleep))
                continue

            for result in payload.get("results", []):
                candidate = _to_candidate(
                    result=result,
                    query=query,
                    allowed_licenses=allowed_licenses,
                    min_width=min_width,
                    min_height=min_height,
                    exclude_keywords=exclude_keywords,
                )
                if candidate is None:
                    continue
                url = candidate["url"]
                if url in seen_urls:
                    continue
                seen_urls.add(url)
                picked.append(candidate)
                if len(picked) >= wanted_count:
                    return picked

            time.sleep(max(0.0, request_sleep))

    return picked


def download_images(items: List[Dict], out_dir: Path, timeout: int) -> List[Dict]:
    out_dir.mkdir(parents=True, exist_ok=True)
    ok: List[Dict] = []

    for idx, item in enumerate(items, start=1):
        suffix = _pick_suffix(item["url"])
        qslug = _slug(item["query"], max_len=18)
        name = f"{idx:03d}_{qslug}_{_slug(item['id'], max_len=28)}{suffix}"
        local_path = out_dir / name

        try:
            resp = requests.get(item["url"], headers={"User-Agent": USER_AGENT}, timeout=timeout)
            resp.raise_for_status()
            data = resp.content
            if not data:
                raise RuntimeError("empty response")
            local_path.write_bytes(data)
        except Exception as exc:  # noqa: BLE001
            print(f"[warn] download failed: {item['url']} ({exc})", file=sys.stderr)
            continue

        enriched = dict(item)
        enriched["local_path"] = str(local_path.resolve())
        ok.append(enriched)

    return ok


def write_catalog_csv(path: Path, items: List[Dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "local_path",
        "query",
        "title",
        "url",
        "creator",
        "creator_url",
        "license",
        "license_url",
        "attribution",
        "foreign_landing_url",
        "provider",
        "source",
        "width",
        "height",
        "id",
    ]
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for item in items:
            row = {k: item.get(k, "") for k in fields}
            writer.writerow(row)


def build_pair_manifest(path: Path, refs: List[Dict], targets: List[Dict], pair_count: int, seed: int) -> int:
    refs_ok = [x for x in refs if x.get("local_path")]
    tgts_ok = [x for x in targets if x.get("local_path")]
    if not refs_ok or not tgts_ok:
        return 0

    random.seed(seed)
    random.shuffle(refs_ok)
    random.shuffle(tgts_ok)

    rows = []
    for i in range(pair_count):
        ref = refs_ok[i % len(refs_ok)]
        src = tgts_ok[i % len(tgts_ok)]
        rows.append(
            {
                "name": f"openverse_{i+1:03d}",
                "reference": ref["local_path"],
                "source": src["local_path"],
            }
        )

    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["name", "reference", "source"])
        writer.writeheader()
        writer.writerows(rows)
    return len(rows)


def build_cartesian_manifest(path: Path, refs: List[Dict], targets: List[Dict]) -> int:
    refs_ok = [x for x in refs if x.get("local_path")]
    tgts_ok = [x for x in targets if x.get("local_path")]
    if not refs_ok or not tgts_ok:
        return 0

    rows = []
    for i, ref in enumerate(refs_ok, start=1):
        for j, tgt in enumerate(tgts_ok, start=1):
            rows.append(
                {
                    "name": f"ref{i:03d}_to_tgt{j:03d}",
                    "reference": ref["local_path"],
                    "source": tgt["local_path"],
                }
            )

    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["name", "reference", "source"])
        writer.writeheader()
        writer.writerows(rows)
    return len(rows)


def _parse_csv_like(values: str) -> set[str]:
    return {x.strip().lower() for x in values.split(",") if x.strip()}


def _load_queries(file_path: str, fallback: List[str]) -> List[str]:
    if not file_path:
        return list(fallback)
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Queries file not found: {path}")
    lines = [line.strip() for line in path.read_text(encoding="utf-8").splitlines()]
    lines = [line for line in lines if line and not line.startswith("#")]
    return lines or list(fallback)


def main() -> int:
    args = parse_args()
    out_root = Path(args.out_root)
    refs_dir = out_root / "references"
    targets_dir = out_root / "targets"

    allowed_licenses = _parse_csv_like(args.licenses)
    allowed_sources = _parse_csv_like(args.sources)
    exclude_keywords = _parse_csv_like(args.exclude_keywords)
    reference_queries = _load_queries(args.reference_queries_file, REFERENCE_QUERIES)
    target_queries = _load_queries(args.target_queries_file, TARGET_QUERIES)

    if not allowed_licenses:
        raise ValueError("No licenses provided")
    if not allowed_sources:
        raise ValueError("No sources provided")

    page_size = min(args.page_size, 20)

    refs = collect_candidates(
        queries=reference_queries,
        wanted_count=args.reference_count,
        allowed_licenses=allowed_licenses,
        allowed_sources=allowed_sources,
        min_width=args.min_width,
        min_height=args.min_height,
        exclude_keywords=exclude_keywords,
        pages_per_query=args.pages_per_query,
        page_size=page_size,
        timeout=args.timeout,
        request_sleep=args.request_sleep,
    )
    targets = collect_candidates(
        queries=target_queries,
        wanted_count=args.target_count,
        allowed_licenses=allowed_licenses,
        allowed_sources=allowed_sources,
        min_width=args.min_width,
        min_height=args.min_height,
        exclude_keywords=exclude_keywords,
        pages_per_query=args.pages_per_query,
        page_size=page_size,
        timeout=args.timeout,
        request_sleep=args.request_sleep,
    )

    refs_local = download_images(refs, refs_dir, timeout=args.timeout)
    targets_local = download_images(targets, targets_dir, timeout=args.timeout)

    references_csv = out_root / "references.csv"
    targets_csv = out_root / "targets.csv"
    manifest_csv = out_root / "manifest.csv"
    manifest_cartesian_csv = out_root / "manifest.cartesian.csv"
    report_json = out_root / "report.json"

    write_catalog_csv(references_csv, refs_local)
    write_catalog_csv(targets_csv, targets_local)
    pair_rows = build_pair_manifest(manifest_csv, refs_local, targets_local, args.pair_count, args.seed)
    cartesian_rows = build_cartesian_manifest(manifest_cartesian_csv, refs_local, targets_local)

    report = {
        "licenses": sorted(allowed_licenses),
        "sources": sorted(allowed_sources),
        "exclude_keywords": sorted(exclude_keywords),
        "page_size_used": page_size,
        "requested_reference_count": args.reference_count,
        "requested_target_count": args.target_count,
        "request_sleep": args.request_sleep,
        "reference_query_count": len(reference_queries),
        "target_query_count": len(target_queries),
        "downloaded_reference_count": len(refs_local),
        "downloaded_target_count": len(targets_local),
        "pair_rows": pair_rows,
        "pair_rows_cartesian": cartesian_rows,
        "references_csv": str(references_csv.resolve()),
        "targets_csv": str(targets_csv.resolve()),
        "manifest_csv": str(manifest_csv.resolve()),
        "manifest_cartesian_csv": str(manifest_cartesian_csv.resolve()),
    }
    report_json.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(json.dumps(report, indent=2))

    if len(refs_local) < max(5, args.reference_count // 2) or len(targets_local) < max(10, args.target_count // 2):
        print(
            "[warn] low material count; try relaxing --min-width/--min-height or add --licenses by,by-sa",
            file=sys.stderr,
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
