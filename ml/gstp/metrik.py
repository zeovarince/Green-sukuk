"""
ml/gstp/metrik.py
=================
Metrik tambahan evaluasi GSTP sesuai docs/revisi/EVALUATION_revisi.md bagian 4A
sampai 4D: waktu deteksi pola beruntun, kelengkapan tautan, biaya, dan uji
perusakan hash-chain melawan tabel log biasa.

Fungsi di sini murni (tidak membaca berkas besar) supaya dapat diuji dengan
data kecil buatan.
"""

from __future__ import annotations

import os
from typing import Any, Dict, Iterable, List, Optional, Sequence

import numpy as np
import pandas as pd

from gstp.ledger import hitung_hash_entri_ledger, kanonikalisasi_payload, verifikasi_rantai_ledger

SUBTIPE_POLA = ("pemecahan_pencairan", "progres_stagnan_tapi_cair")
KOLOM_ENTRI = ("seq", "payload_kanonik", "hash_payload", "hash_sebelumnya", "hash_saat_ini")


def _persen(bagian: int, total: int) -> float:
    return round(100.0 * bagian / total, 2) if total > 0 else 0.0


def deteksi_pola_beruntun(df: pd.DataFrame, prediksi: Dict[str, Sequence[int]]) -> Dict[str, Any]:
    """
    Bagian 4A. Pola beruntun adalah rangkaian baris anomali bersubtipe
    `pemecahan_pencairan` atau `progres_stagnan_tapi_cair` pada kontrak yang sama,
    berurutan menurut `trx_id`, tanpa baris non-anomali dari kontrak itu di antaranya.

    `prediksi` berisi larik 0/1 yang sejajar posisi baris `df`.
    """
    wajib = {"kontrak_id", "trx_id", "label_anomali", "subtipe_kasus"}
    hilang = wajib.difference(df.columns)
    if hilang:
        raise ValueError(f"Kolom wajib tidak ada: {sorted(hilang)}")

    larik = {}
    for nama, nilai in prediksi.items():
        larik[nama] = np.asarray(nilai, dtype=int)
        if len(larik[nama]) != len(df):
            raise ValueError(f"Panjang prediksi {nama} ({len(larik[nama])}) tidak sama dengan jumlah baris ({len(df)}).")

    urut = df.reset_index(drop=True).sort_values(["kontrak_id", "trx_id"], kind="mergesort")
    posisi_asli = urut.index.to_numpy()

    pola: List[Dict[str, Any]] = []
    kontrak_aktif: Optional[str] = None
    posisi_aktif: List[int] = []

    def tutup() -> None:
        if posisi_aktif:
            pola.append({"kontrak_id": kontrak_aktif, "posisi": list(posisi_aktif)})
        posisi_aktif.clear()

    for urutan, (_, baris) in enumerate(urut.iterrows()):
        target = int(baris["label_anomali"]) == 1 and str(baris["subtipe_kasus"]) in SUBTIPE_POLA
        if not target:
            tutup()
            kontrak_aktif = None
            continue
        if kontrak_aktif is not None and str(baris["kontrak_id"]) != kontrak_aktif:
            tutup()
        kontrak_aktif = str(baris["kontrak_id"])
        posisi_aktif.append(urutan)
    tutup()

    hasil: Dict[str, Any] = {"jumlah_pola": len(pola)}
    rincian = []
    for item in pola:
        posisi = np.asarray(item["posisi"], dtype=int)
        terdeteksi: Dict[str, Optional[int]] = {}
        for nama, nilai in larik.items():
            ditandai = np.flatnonzero(nilai[posisi_asli[posisi]] == 1)
            terdeteksi[nama] = int(ditandai[0] + 1) if len(ditandai) else None
        rincian.append({
            "kontrak_id": item["kontrak_id"],
            "panjang": int(len(posisi)),
            "posisi_terdeteksi": terdeteksi,
        })

    for nama in larik:
        posisi_terdeteksi = [r["posisi_terdeteksi"][nama] for r in rincian if r["posisi_terdeteksi"][nama] is not None]
        hasil[nama] = {
            "terdeteksi_pct": _persen(len(posisi_terdeteksi), len(pola)),
            "median_posisi": round(float(np.median(posisi_terdeteksi)), 2) if posisi_terdeteksi else None,
        }
    hasil["rincian"] = rincian
    return hasil


def _ringkas_tautan(df: pd.DataFrame, proyek_sah: set[str], peta_kontrak: Dict[str, str], trx_ledger: set[str]) -> Dict[str, Any]:
    n = int(len(df))
    if n == 0:
        return {
            "n": 0,
            "proyek_valid": 0.0,
            "kontrak_milik_proyek": 0.0,
            "hash_cocok": 0.0,
            "entri_ledger": 0.0,
            "gabungan": 0.0,
        }

    proyek = df["project_id"].astype(str)
    kontrak = df["kontrak_id"].astype(str)
    syarat_proyek = proyek.isin(proyek_sah).to_numpy()
    syarat_kontrak = np.array([peta_kontrak.get(k) == p for k, p in zip(kontrak, proyek)], dtype=bool)
    syarat_hash = (df["hash_tercatat"].astype(str) == df["hash_dokumen_saat_ini"].astype(str)).to_numpy()
    syarat_ledger = df["trx_id"].astype(str).isin(trx_ledger).to_numpy()
    gabungan = syarat_proyek & syarat_kontrak & syarat_hash & syarat_ledger

    return {
        "n": n,
        "proyek_valid": round(float(syarat_proyek.mean()), 4),
        "kontrak_milik_proyek": round(float(syarat_kontrak.mean()), 4),
        "hash_cocok": round(float(syarat_hash.mean()), 4),
        "entri_ledger": round(float(syarat_ledger.mean()), 4),
        "gabungan": round(float(gabungan.mean()), 4),
    }


def kelengkapan_tautan(
    df: pd.DataFrame,
    df_prj: pd.DataFrame,
    df_ktr: pd.DataFrame,
    trx_ledger: Iterable[str],
) -> Dict[str, Any]:
    """
    Bagian 4B. Persentase transaksi yang memenuhi empat syarat:
    project_id valid, kontrak ada dan milik proyek itu, hash cocok, dan punya
    entri ledger jenis `transaksi`.

    Kunci datar mengikuti `EVALUATION.md` bagian 9 dan dihitung pada split
    `pengujian`; rincian `seluruh_data` ditambahkan terpisah.
    """
    proyek_sah = set(df_prj["project_id"].astype(str))
    peta_kontrak = {str(k): str(p) for k, p in zip(df_ktr["kontrak_id"], df_ktr["project_id"])}
    ledger = {str(t) for t in trx_ledger}

    if "split" in df.columns:
        df_uji = df[df["split"].astype(str) == "pengujian"]
    else:
        df_uji = df
    hasil = _ringkas_tautan(df_uji, proyek_sah, peta_kontrak, ledger)
    hasil["seluruh_data"] = _ringkas_tautan(df, proyek_sah, peta_kontrak, ledger)
    return hasil


def hitung_biaya(
    *,
    model_path: str,
    ledger_path: str,
    transaksi_path: str,
    jumlah_baris_transaksi: int,
    jumlah_baris_ledger: int,
    waktu_latih_detik: float,
    waktu_inferensi_ms: float,
    waktu_verifikasi_penuh_detik: float,
) -> Dict[str, Any]:
    """
    Bagian 4C. Ukuran berkas dan waktu diukur apa adanya, tanpa konversi rupiah.
    Ukuran tabel Supabase dan paket layanan diisi pemilik dari dashboard.
    """
    return {
        "ukuran_model_kb": round(os.path.getsize(model_path) / 1024.0, 2),
        "waktu_latih_detik": round(float(waktu_latih_detik), 3),
        "waktu_inferensi_ms": round(float(waktu_inferensi_ms), 3),
        "waktu_verifikasi_penuh_detik": round(float(waktu_verifikasi_penuh_detik), 3),
        "baris_transaksi": int(jumlah_baris_transaksi),
        "ukuran_transaksi_csv_kb": round(os.path.getsize(transaksi_path) / 1024.0, 2),
        "baris_ledger": int(jumlah_baris_ledger),
        "ukuran_ledger_csv_kb": round(os.path.getsize(ledger_path) / 1024.0, 2),
        "catatan": "Ukuran tabel Supabase dan paket layanan Vercel/Supabase diisi pemilik dari dashboard saat pengukuran deployment.",
    }


def _salin_dasar(entri: Sequence[Dict[str, Any]], batas: int) -> List[Dict[str, Any]]:
    dasar = [{kolom: item[kolom] for kolom in KOLOM_ENTRI} for item in entri[:batas]]
    dasar.sort(key=lambda item: int(item["seq"]))
    return dasar


def _hitung_ulang(entri: List[Dict[str, Any]]) -> None:
    sebelumnya = "GENESIS"
    for item in entri:
        hash_payload, hash_saat_ini = hitung_hash_entri_ledger(sebelumnya, str(item["payload_kanonik"]))
        item["hash_sebelumnya"] = sebelumnya
        item["hash_payload"] = hash_payload
        item["hash_saat_ini"] = hash_saat_ini
        sebelumnya = hash_saat_ini


def _periksa(dasar: Sequence[Dict[str, Any]], salinan: List[Dict[str, Any]], seq_target: Optional[int]) -> tuple[bool, bool]:
    hasil = verifikasi_rantai_ledger(salinan)
    terdeteksi = not bool(hasil["valid"])
    tepat = bool(
        terdeteksi
        and seq_target is not None
        and hasil.get("rusak_pada") is not None
        and int(hasil["rusak_pada"]) == int(seq_target)
    )
    return terdeteksi, tepat


def _ringkas_skenario(terdeteksi: int, tepat: int, total: int) -> Dict[str, float]:
    return {
        "terdeteksi_pct": _persen(terdeteksi, total),
        "lokasi_tepat_pct": _persen(tepat, total),
    }


def _entri_palsu(sebelumnya: str, seq: int) -> Dict[str, Any]:
    payload = kanonikalisasi_payload({"jenis": "palsu", "seq": int(seq), "catatan": "sisipan uji"})
    hash_payload, hash_saat_ini = hitung_hash_entri_ledger(sebelumnya, payload)
    return {
        "seq": int(seq),
        "payload_kanonik": payload,
        "hash_payload": hash_payload,
        "hash_sebelumnya": sebelumnya,
        "hash_saat_ini": hash_saat_ini,
    }


def uji_perusakan(
    entri: Sequence[Dict[str, Any]],
    *,
    percobaan: int = 200,
    seed: int = 42,
    batas: int = 1000,
) -> Dict[str, Any]:
    """
    Bagian 4D. Lima skenario perusakan pada salinan ledger lokal, masing-masing
    `percobaan` kali dengan posisi acak (seed bawaan 42). Pembanding adalah tabel
    log biasa tanpa hash, yang tidak dapat mendeteksi perubahan apa pun.

    Skenario:
    - ubah: ganti payload satu entri.
    - hapus: hapus satu entri. Penghapusan entri terakhir tidak terdeteksi tanpa
      hash jangkar di luar basis data, jadi persentasenya dilaporkan apa adanya.
    - sisip: sisipkan satu entri palsu sebelum entri yang ada.
    - tukar: tukar dua entri bersebelahan.
    - hitung_ulang: ubah satu entri lalu hitung ulang seluruh rantai sesudahnya.
    """
    if percobaan <= 0:
        raise ValueError("percobaan harus lebih dari nol.")
    dasar = _salin_dasar(entri, batas)
    if len(dasar) < 3:
        raise ValueError("Uji perusakan memerlukan sedikitnya tiga entri.")
    awal = verifikasi_rantai_ledger(dasar)
    if not awal["valid"]:
        raise ValueError(f"Rantai dasar tidak valid pada seq {awal.get('rusak_pada')}.")

    n = len(dasar)
    rng = np.random.default_rng(seed)
    hasil: Dict[str, Any] = {
        "seed": seed,
        "percobaan_per_skenario": int(percobaan),
        "jumlah_entri": n,
    }

    # 1. Ubah payload satu entri.
    deteksi = tepat = 0
    for _ in range(percobaan):
        pos = int(rng.integers(0, n))
        salinan = [dict(item) for item in dasar]
        salinan[pos]["payload_kanonik"] = f"{salinan[pos]['payload_kanonik']}|ubah"
        d, t = _periksa(dasar, salinan, int(dasar[pos]["seq"]))
        deteksi += int(d)
        tepat += int(t)
    hasil["ubah"] = _ringkas_skenario(deteksi, tepat, percobaan)

    # 2. Hapus satu entri yang memiliki penerus. Pemotongan entri terakhir
    # hanya terdeteksi dengan hash jangkar di luar basis data.
    deteksi = tepat = 0
    for _ in range(percobaan):
        pos = int(rng.integers(0, n - 1))
        salinan = [dict(item) for item in dasar]
        del salinan[pos]
        target = int(dasar[pos + 1]["seq"])
        d, t = _periksa(dasar, salinan, target)
        deteksi += int(d)
        tepat += int(t)
    hasil["hapus"] = _ringkas_skenario(deteksi, tepat, percobaan)

    # 3. Sisipkan satu entri palsu sebelum entri yang ada.
    deteksi = tepat = 0
    for _ in range(percobaan):
        pos = int(rng.integers(0, n))
        salinan = [dict(item) for item in dasar]
        sebelumnya = salinan[pos - 1]["hash_saat_ini"] if pos > 0 else "GENESIS"
        salinan.insert(pos, _entri_palsu(sebelumnya, int(dasar[pos]["seq"])))
        d, t = _periksa(dasar, salinan, int(dasar[pos]["seq"]))
        deteksi += int(d)
        tepat += int(t)
    hasil["sisip"] = _ringkas_skenario(deteksi, tepat, percobaan)

    # 4. Tukar isi dua entri bersebelahan. Seq tetap, sehingga urutan baca tidak
    # memulihkan keadaan semula.
    deteksi = tepat = 0
    for _ in range(percobaan):
        pos = int(rng.integers(0, n - 1))
        salinan = [dict(item) for item in dasar]
        kiri, kanan = salinan[pos], salinan[pos + 1]
        for kolom in ("payload_kanonik", "hash_payload", "hash_sebelumnya", "hash_saat_ini"):
            kiri[kolom], kanan[kolom] = kanan[kolom], kiri[kolom]
        d, t = _periksa(dasar, salinan, int(dasar[pos]["seq"]))
        deteksi += int(d)
        tepat += int(t)
    hasil["tukar"] = _ringkas_skenario(deteksi, tepat, percobaan)

    # 5. Ubah satu entri lalu hitung ulang seluruh rantai sesudahnya.
    deteksi = tepat = 0
    for _ in range(percobaan):
        pos = int(rng.integers(0, n))
        salinan = [dict(item) for item in dasar]
        salinan[pos]["payload_kanonik"] = f"{salinan[pos]['payload_kanonik']}|ubah"
        _hitung_ulang(salinan)
        d, t = _periksa(dasar, salinan, int(dasar[pos]["seq"]))
        deteksi += int(d)
        tepat += int(t)
    hasil["hitung_ulang"] = _ringkas_skenario(deteksi, tepat, percobaan)

    kosong = {"terdeteksi_pct": 0.0, "lokasi_tepat_pct": 0.0}
    for nama in ("ubah", "hapus", "sisip", "tukar", "hitung_ulang"):
        hasil[nama] = {"hash_chain": hasil[nama], "tabel_log": dict(kosong)}

    hasil["catatan"] = (
        "Tabel log biasa tidak memiliki hash, sehingga tidak mendeteksi perubahan apa pun. "
        "Skenario hitung ulang seluruh rantai tidak terdeteksi oleh keduanya. "
        "Pemotongan entri terakhir juga tidak terdeteksi tanpa hash jangkar di luar basis data, "
        "jadi skenario hapus dibatasi pada entri yang memiliki penerus."
    )
    return hasil
