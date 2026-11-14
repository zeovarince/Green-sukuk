"""
ml/ukur_latensi.py
==================
Mengukur latensi route `/api/periksa` sesuai docs/revisi/EVALUATION_revisi.md
bagian 4E: median dan persentil 95 untuk `waktu_proses_ms` (server) dan waktu
total di sisi klien.

Contoh:
    python ml/ukur_latensi.py
    python ml/ukur_latensi.py --url https://gstp-demo.vercel.app --jumlah 30
    python ml/ukur_latensi.py --url https://gstp-demo.vercel.app --dingin

Catatan:
- `--dingin` mengirim satu permintaan pertama sebelum 30 permintaan terukur.
  Jalankan setelah URL diam sedikitnya 10 menit agar permintaan itu mewakili
  cold start. Tanpa `--dingin`, semua permintaan dianggap hangat.
- Tanpa `--kontrak-id`, skrip memilih kontrak pertama dari
  `ml/data_simulasi/registri_kontrak.csv` dan mengambil kategori hijau dari
  registri proyek. Data ini hanya untuk payload uji, tidak disimpan
  (`simpan: false`).
- Region Vercel dan Supabase tidak dapat dibaca dari sini; isi lewat opsi
  `--region-vercel` dan `--region-supabase`, atau lengkapi manual di artefak.
"""

from __future__ import annotations

import argparse
import json
import os
import statistics
import time
import urllib.error
import urllib.request
from datetime import datetime

import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data_simulasi")
ARTIFACTS_DIR = os.path.join(BASE_DIR, "artifacts")

PERCENTIL = 95
KATEGORI_BAWAAN = "Energi terbarukan"


def pilih_kontrak(kontrak_id: str | None, project_id: str | None):
    """Ambil satu kontrak dari registri simulasi untuk bahan payload."""
    df_ktr = pd.read_csv(os.path.join(DATA_DIR, "registri_kontrak.csv"))
    df_prj = pd.read_csv(os.path.join(DATA_DIR, "registri_proyek.csv"))
    if kontrak_id:
        baris = df_ktr[df_ktr["kontrak_id"].astype(str) == str(kontrak_id)]
        if baris.empty:
            raise SystemExit(f"Kontrak {kontrak_id} tidak ada di registri simulasi.")
    else:
        baris = df_ktr.head(1)
    kontrak = baris.iloc[0]
    pid = str(project_id or kontrak["project_id"])
    proyek = df_prj[df_prj["project_id"].astype(str) == pid]
    kategori = str(proyek.iloc[0]["kategori_hijau"]) if not proyek.empty else KATEGORI_BAWAAN
    return {
        "kontrak_id": str(kontrak["kontrak_id"]),
        "project_id": pid,
        "tanggal": "2025-08-15",
        "jenis_pembayaran": "termin",
        "nilai_pencairan": max(1, int(round(float(kontrak["nilai_kontrak_awal"]) * 0.01))),
        "progres_fisik_pct": 50.0,
        "milestone_terverifikasi": True,
        "persetujuan_diperoleh": 2,
        "kelengkapan_bukti": 1.0,
        "kategori_hijau": kategori,
        "hash_tercatat": "hash-demo-latensi",
        "hash_dokumen_saat_ini": "hash-demo-latensi",
        "simpan": False,
    }


def kirim(url: str, payload: dict, timeout: float) -> tuple[float, float | None]:
    """Kirim satu permintaan; kembalikan (total_klien_ms, waktu_proses_ms)."""
    badan = json.dumps(payload).encode("utf-8")
    permintaan = urllib.request.Request(
        f"{url.rstrip('/')}/api/periksa",
        data=badan,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    mulai = time.perf_counter()
    try:
        with urllib.request.urlopen(permintaan, timeout=timeout) as respons:
            isi = respons.read()
    except urllib.error.HTTPError as galat:
        detail = galat.read().decode("utf-8", errors="replace")[:300]
        raise SystemExit(f"HTTP {galat.code} dari {url}: {detail}") from galat
    except urllib.error.URLError as galat:
        raise SystemExit(f"Tidak dapat menghubungi {url}: {galat.reason}") from galat
    total_ms = (time.perf_counter() - mulai) * 1000.0
    try:
        data = json.loads(isi.decode("utf-8"))
    except json.JSONDecodeError:
        data = {}
    proses = data.get("waktu_proses_ms")
    if not isinstance(proses, (int, float)):
        proses = None
    return total_ms, proses


def ringkas(nilai: list[float]) -> dict:
    if not nilai:
        return {"n": 0, "median": None, "p95": None, "min": None, "maks": None}
    return {
        "n": len(nilai),
        "median": round(float(statistics.median(nilai)), 2),
        "p95": round(float(persentil(nilai, PERCENTIL)), 2),
        "min": round(float(min(nilai)), 2),
        "maks": round(float(max(nilai)), 2),
    }


def persentil(nilai: list[float], p: int) -> float:
    urut = sorted(nilai)
    if len(urut) == 1:
        return urut[0]
    posisi = (len(urut) - 1) * (p / 100.0)
    bawah = int(posisi)
    atas = min(bawah + 1, len(urut) - 1)
    pecahan = posisi - bawah
    return urut[bawah] + (urut[atas] - urut[bawah]) * pecahan


def main() -> None:
    parser = argparse.ArgumentParser(description="Ukur latensi /api/periksa GSTP")
    parser.add_argument("--url", default="http://localhost:3000", help="basis URL aplikasi (default http://localhost:3000)")
    parser.add_argument("--kontrak-id", default=None, help="kontrak yang dipakai untuk payload uji")
    parser.add_argument("--project-id", default=None, help="project_id bila ingin menimpa registri")
    parser.add_argument("--jumlah", type=int, default=30, help="jumlah permintaan terukur (default 30)")
    parser.add_argument("--dingin", action="store_true", help="kirim satu permintaan cold start lebih dulu")
    parser.add_argument("--timeout", type=float, default=30.0, help="batas waktu tiap permintaan dalam detik")
    parser.add_argument("--region-vercel", default="", help="region fungsi Vercel, mis. sin1")
    parser.add_argument("--region-supabase", default="", help="region proyek Supabase, mis. ap-southeast-1")
    parser.add_argument("--keluaran", default=os.path.join(ARTIFACTS_DIR, "latensi.json"), help="berkas artefak hasil")
    args = parser.parse_args()

    if args.jumlah <= 0:
        raise SystemExit("--jumlah harus lebih dari nol.")

    payload = pilih_kontrak(args.kontrak_id, args.project_id)
    print(f"URL        : {args.url}")
    print(f"Kontrak    : {payload['kontrak_id']} ({payload['project_id']})")
    print(f"Permintaan : {args.jumlah} terukur" + (" + 1 cold start" if args.dingin else ""))

    dingin = None
    if args.dingin:
        print("Mengirim permintaan cold start ...")
        total_dingin, proses_dingin = kirim(args.url, payload, args.timeout)
        dingin = {"total_klien_ms": round(total_dingin, 2), "waktu_proses_ms": proses_dingin}
        print(f"  cold start: server {proses_dingin} ms, klien {total_dingin:.2f} ms")

    total_klien: list[float] = []
    waktu_server: list[float] = []
    print("Mengirim permintaan terukur ...")
    for i in range(1, args.jumlah + 1):
        total, proses = kirim(args.url, payload, args.timeout)
        total_klien.append(total)
        if proses is not None:
            waktu_server.append(float(proses))
        if i % 5 == 0 or i == args.jumlah:
            print(f"  {i}/{args.jumlah} selesai")

    hasil = {
        "diukur_pada": datetime.now().isoformat(timespec="seconds"),
        "url": args.url,
        "kontrak_id": payload["kontrak_id"],
        "project_id": payload["project_id"],
        "jumlah_permintaan": args.jumlah,
        "cold_start": dingin,
        "waktu_proses_ms": ringkas(waktu_server),
        "total_klien_ms": ringkas(total_klien),
        "lokasi": "lokal" if "localhost" in args.url or "127.0.0.1" in args.url else "publik",
        "region_vercel": args.region_vercel,
        "region_supabase": args.region_supabase,
        "catatan": (
            "Satu lokasi dan satu hari pengukuran tidak mewakili kondisi lain. "
            "`waktu_proses_ms` berasal dari respons server; total klien termasuk jaringan. "
            "Cold start hanya bermakna bila skrip dijalankan setelah URL diam sedikitnya 10 menit."
        ),
    }

    os.makedirs(os.path.dirname(os.path.abspath(args.keluaran)), exist_ok=True)
    with open(args.keluaran, "w", encoding="utf-8") as f:
        json.dump(hasil, f, ensure_ascii=False, indent=2)

    print("\n=== RINGKASAN LATENSI ===")
    for nama, label in (("waktu_proses_ms", "server"), ("total_klien_ms", "klien")):
        angka = hasil[nama]
        print(f"{label:7s}: median {angka['median']} ms, p95 {angka['p95']} ms, min {angka['min']}, maks {angka['maks']}")
    if dingin:
        print(f"cold   : server {dingin['waktu_proses_ms']} ms, klien {dingin['total_klien_ms']} ms")
    print(f"\nArtefak tersimpan di: {args.keluaran}")


if __name__ == "__main__":
    main()
