"""
ml/gstp/fitur.py
================
Ekstraksi dan rekayasa fitur untuk model Isolation Forest GSTP
sesuai docs/MODEL_SPEC.md bagian 3 (revisi 18 fitur).
"""

from __future__ import annotations
import json
import os
import numpy as np
import pandas as pd
from typing import Any, Dict, List, Optional, Sequence

# Daftar 18 fitur berurutan persis sesuai MODEL_SPEC.md bagian 3
DAFTAR_FITUR: List[str] = [
    "log_nilai",
    "rasio_nilai_terhadap_kontrak",
    "rasio_kumulatif_pagu",
    "rasio_kumulatif_kontrak",
    "hari_sejak_pencairan_sebelumnya",
    "delta_progres_pct",
    "progres_fisik_pct",
    "bulan_ke",
    "persetujuan_wajib",
    "jenis_uang_muka",
    "jenis_termin",
    "jenis_retensi",
    "rasio_nilai_vs_progres",
    "jumlah_pencairan_7_hari",
    "nilai_vs_median_kontrak",
    "kelengkapan_bukti",
    "rasio_nilai_vs_median_kelompok",
    "deviasi_jadwal_pct",
]


def hitung_referensi_kelompok(df_dev_lolos: pd.DataFrame) -> Dict[str, Any]:
    """
    Menghitung tabel referensi kelompok dari split pengembangan yang lolos aturan (MODEL_SPEC.md bagian 3).
    - median_per_kelompok: per pasangan (kategori_hijau, tahap_proyek), kunci: f"{kategori}|{tahap}"
    - median_per_tahap: per tahap_proyek
    - median_global: median seluruh split pengembangan lolos aturan
    """
    nilai = df_dev_lolos["nilai_pencairan"].astype(float)
    df_temp = df_dev_lolos.copy()
    keys = df_temp["kategori_hijau"].astype(str) + "|" + df_temp["tahap_proyek"].astype(str)
    df_temp["_kelompok_key"] = keys
    med_kel = df_temp.groupby("_kelompok_key")["nilai_pencairan"].median().to_dict()
    med_tahap = df_temp.groupby("tahap_proyek")["nilai_pencairan"].median().to_dict()
    med_global = float(nilai.median()) if len(nilai) > 0 else 1.0

    return {
        "median_per_kelompok": {str(k): float(v) for k, v in med_kel.items()},
        "median_per_tahap": {str(k): float(v) for k, v in med_tahap.items()},
        "median_global": float(med_global),
    }


def cari_median_referensi(
    kategori_hijau: str,
    tahap_proyek: str,
    referensi_kelompok: Optional[Dict[str, Any]] = None,
) -> float:
    """Mencari nilai median referensi sesuai urutan: kelompok -> tahap -> global."""
    if not referensi_kelompok:
        return 1.0
    med_kel = referensi_kelompok.get("median_per_kelompok", {})
    key = f"{kategori_hijau}|{tahap_proyek}"
    if key in med_kel and med_kel[key] > 0:
        return float(med_kel[key])
    med_tahap = referensi_kelompok.get("median_per_tahap", {})
    if tahap_proyek in med_tahap and med_tahap[tahap_proyek] > 0:
        return float(med_tahap[tahap_proyek])
    med_global = referensi_kelompok.get("median_global", 1.0)
    return float(med_global) if med_global > 0 else 1.0


def hitung_deviasi_jadwal(progres_fisik_pct: float, bulan_ke: float, durasi_bulan: float) -> float:
    """Menghitung deviasi jadwal terhadap kurva-S acuan (MODEL_SPEC.md bagian 3)."""
    if durasi_bulan <= 0:
        u = 1.0
    else:
        u = min(max(float(bulan_ke) / float(durasi_bulan), 0.0), 1.0)
    L_u = 1.0 / (1.0 + np.exp(-8.0 * (u - 0.5)))
    L_0 = 1.0 / (1.0 + np.exp(4.0))
    L_1 = 1.0 / (1.0 + np.exp(-4.0))
    jadwal_acuan_pct = 100.0 * (L_u - L_0) / (L_1 - L_0)
    return float(progres_fisik_pct - jadwal_acuan_pct)


def bangun_fitur_dataframe(
    df: pd.DataFrame,
    referensi_kelompok: Optional[Dict[str, Any]] = None,
    peta_durasi_kontrak: Optional[Dict[str, float]] = None,
) -> pd.DataFrame:
    """
    Membangun matriks 18 fitur dari DataFrame transaksi yang sudah memiliki riwayat lengkap.
    df harus memiliki urutan kronologis per kontrak_id.
    """
    df = df.copy()
    if not np.issubdtype(df["tanggal"].dtype, np.datetime64):
        df["tanggal"] = pd.to_datetime(df["tanggal"])

    # Urutkan berdasarkan tanggal & index
    df = df.sort_values(["tanggal", "kontrak_id"], kind="mergesort").reset_index(drop=True)

    # 1. log_nilai: log1p(nilai_pencairan)
    log_nilai = np.log1p(df["nilai_pencairan"].astype(float))

    # 2. rasio dasar
    rasio_nilai_terhadap_kontrak = df["rasio_nilai_terhadap_kontrak"].astype(float)
    rasio_kumulatif_pagu = df["rasio_kumulatif_pagu"].astype(float)
    rasio_kumulatif_kontrak = df["rasio_kumulatif_kontrak"].astype(float)
    hari_sejak_pencairan_sebelumnya = df["hari_sejak_pencairan_sebelumnya"].astype(float)
    delta_progres_pct = df["delta_progres_pct"].astype(float)
    progres_fisik_pct = df["progres_fisik_pct"].astype(float)
    bulan_ke = df["bulan_ke"].astype(float)
    persetujuan_wajib = df["persetujuan_wajib"].astype(float)

    # 3. one-hot jenis_pembayaran
    jenis = df["jenis_pembayaran"].astype(str).str.lower()
    jenis_uang_muka = (jenis == "uang_muka").astype(float)
    jenis_termin = (jenis == "termin").astype(float)
    jenis_retensi = (jenis == "retensi").astype(float)

    # 4. rasio_nilai_vs_progres: rasio_nilai_terhadap_kontrak / max(delta_progres_pct / 100, 0.005)
    penyebut = np.maximum(delta_progres_pct / 100.0, 0.005)
    rasio_nilai_vs_progres = rasio_nilai_terhadap_kontrak / penyebut

    # 5. Konteks riwayat kontrak: jumlah_pencairan_7_hari dan nilai_vs_median_kontrak
    jumlah_7_hari = np.zeros(len(df), dtype=float)
    nilai_vs_median = np.ones(len(df), dtype=float)

    # Dihitung per kontrak
    grup = df.groupby("kontrak_id", sort=False)
    for _, idxs in grup.groups.items():
        sub_idx = np.array(list(idxs))
        sub_tgl = df.loc[sub_idx, "tanggal"].values
        sub_nilai = df.loc[sub_idx, "nilai_pencairan"].values.astype(float)

        for pos in range(len(sub_idx)):
            curr_tgl = sub_tgl[pos]
            curr_nilai = sub_nilai[pos]

            # 7 hari sebelum dan termasuk transaksi ini (dalam window [curr_tgl - 7 days, curr_tgl])
            batas_bawah = curr_tgl - np.timedelta64(7, 'D')
            mask_7d = (sub_tgl[:pos + 1] >= batas_bawah) & (sub_tgl[:pos + 1] <= curr_tgl)
            jumlah_7_hari[sub_idx[pos]] = float(np.sum(mask_7d))

            # median nilai pencairan sebelumnya di kontrak itu (1.0 jika belum ada riwayat)
            if pos == 0:
                nilai_vs_median[sub_idx[pos]] = 1.0
            else:
                med = float(np.median(sub_nilai[:pos]))
                if med > 0:
                    nilai_vs_median[sub_idx[pos]] = curr_nilai / med
                else:
                    nilai_vs_median[sub_idx[pos]] = 1.0

    # 6. Tiga fitur baru (REV-03)
    # 6a. kelengkapan_bukti
    kelengkapan_bukti = df["kelengkapan_bukti"].astype(float)

    # 6b. rasio_nilai_vs_median_kelompok
    if referensi_kelompok is None:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        model_path = os.path.join(base_dir, "artifacts", "model_if.json")
        if os.path.exists(model_path):
            try:
                with open(model_path, "r", encoding="utf-8") as f:
                    m_data = json.load(f)
                referensi_kelompok = m_data.get("referensi_kelompok")
            except Exception:
                referensi_kelompok = None
        if referensi_kelompok is None:
            referensi_kelompok = hitung_referensi_kelompok(df)

    kategori_col = df["kategori_hijau"].astype(str)
    tahap_col = df["tahap_proyek"].astype(str)
    nilai_col = df["nilai_pencairan"].astype(float)

    med_kel = referensi_kelompok.get("median_per_kelompok", {})
    med_tahap = referensi_kelompok.get("median_per_tahap", {})
    med_global = float(referensi_kelompok.get("median_global", 1.0))
    if med_global <= 0:
        med_global = 1.0

    key_series = kategori_col + "|" + tahap_col
    med_series = key_series.map(med_kel)
    med_series = med_series.fillna(tahap_col.map(med_tahap))
    med_series = med_series.fillna(med_global)
    med_series = med_series.replace(0, med_global).fillna(med_global).astype(float)
    rasio_nilai_vs_median_kelompok = nilai_col / med_series

    # 6c. deviasi_jadwal_pct
    if "durasi_bulan" in df.columns:
        durasi = df["durasi_bulan"].astype(float)
    elif peta_durasi_kontrak is not None:
        durasi = df["kontrak_id"].map(peta_durasi_kontrak).fillna(12.0).astype(float)
    else:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        reg_ktr_path = os.path.join(base_dir, "data_simulasi", "registri_kontrak.csv")
        if os.path.exists(reg_ktr_path):
            df_ktr = pd.read_csv(reg_ktr_path)
            dur_map = df_ktr.set_index("kontrak_id")["durasi_bulan"].to_dict()
            durasi = df["kontrak_id"].map(dur_map).fillna(12.0).astype(float)
        else:
            durasi = pd.Series(12.0, index=df.index)

    durasi_pos = np.where(durasi.values <= 0, 1.0, durasi.values)
    u_vals = np.clip(bulan_ke.values / durasi_pos, 0.0, 1.0)
    L_u = 1.0 / (1.0 + np.exp(-8.0 * (u_vals - 0.5)))
    L_0 = 1.0 / (1.0 + np.exp(4.0))
    L_1 = 1.0 / (1.0 + np.exp(-4.0))
    jadwal_acuan_pct = 100.0 * (L_u - L_0) / (L_1 - L_0)
    deviasi_jadwal_pct = progres_fisik_pct.values - jadwal_acuan_pct

    feat_df = pd.DataFrame({
        "log_nilai": log_nilai,
        "rasio_nilai_terhadap_kontrak": rasio_nilai_terhadap_kontrak,
        "rasio_kumulatif_pagu": rasio_kumulatif_pagu,
        "rasio_kumulatif_kontrak": rasio_kumulatif_kontrak,
        "hari_sejak_pencairan_sebelumnya": hari_sejak_pencairan_sebelumnya,
        "delta_progres_pct": delta_progres_pct,
        "progres_fisik_pct": progres_fisik_pct,
        "bulan_ke": bulan_ke,
        "persetujuan_wajib": persetujuan_wajib,
        "jenis_uang_muka": jenis_uang_muka,
        "jenis_termin": jenis_termin,
        "jenis_retensi": jenis_retensi,
        "rasio_nilai_vs_progres": rasio_nilai_vs_progres,
        "jumlah_pencairan_7_hari": jumlah_7_hari,
        "nilai_vs_median_kontrak": nilai_vs_median,
        "kelengkapan_bukti": kelengkapan_bukti,
        "rasio_nilai_vs_median_kelompok": rasio_nilai_vs_median_kelompok,
        "deviasi_jadwal_pct": deviasi_jadwal_pct,
    })

    return feat_df[DAFTAR_FITUR]


def hitung_fitur_satu_transaksi(
    transaksi: Dict[str, Any],
    riwayat_kontrak: Sequence[Dict[str, Any]],
    pagu_alokasi_kontrak: float | int,
    nilai_kontrak: float | int,
    tanggal_mulai_kontrak: Optional[str] = None,
    referensi_kelompok: Optional[Dict[str, Any]] = None,
    durasi_bulan: Optional[float | int] = None,
    tahap_proyek: Optional[str] = None,
) -> Dict[str, float]:
    """
    Menghitung 18 fitur untuk satu transaksi baru berdasarkan riwayat transaksi kontrak sebelumnya.
    Dipakai saat transaksi baru masuk (API / golden cases).
    """
    curr_tgl = pd.to_datetime(transaksi["tanggal"])
    curr_nilai = float(transaksi["nilai_pencairan"])
    curr_progres = float(transaksi.get("progres_fisik_pct", 0.0))
    jenis = str(transaksi.get("jenis_pembayaran", "")).lower()

    # Urutkan riwayat berdasarkan tanggal
    riw = sorted(riwayat_kontrak, key=lambda x: pd.to_datetime(x["tanggal"]))

    # Hitung fitur turunan dari riwayat
    if len(riw) == 0:
        if tanggal_mulai_kontrak is not None:
            tgl_mulai = pd.to_datetime(tanggal_mulai_kontrak)
            hari_sejak_prev = float((curr_tgl - tgl_mulai).days)
        else:
            hari_sejak_prev = 0.0
        delta_progres = curr_progres
        kumulatif_cair = curr_nilai
        nilai_vs_med = 1.0
    else:
        last_tgl = pd.to_datetime(riw[-1]["tanggal"])
        hari_sejak_prev = float((curr_tgl - last_tgl).days)
        last_progres = float(riw[-1].get("progres_fisik_pct", 0.0))
        delta_progres = float(round(curr_progres - last_progres, 2))
        total_prev = sum(float(r["nilai_pencairan"]) for r in riw)
        kumulatif_cair = total_prev + curr_nilai
        nilai_riw = [float(r["nilai_pencairan"]) for r in riw]
        med = float(np.median(nilai_riw))
        nilai_vs_med = float(curr_nilai / med) if med > 0 else 1.0

    # 7 hari window
    batas_7d = curr_tgl - pd.Timedelta(days=7)
    cnt_7d = 1  # termasuk transaksi ini
    for r in riw:
        t = pd.to_datetime(r["tanggal"])
        if batas_7d <= t <= curr_tgl:
            cnt_7d += 1

    rasio_nilai_kontrak = float(round(curr_nilai / float(nilai_kontrak), 5)) if float(nilai_kontrak) > 0 else 0.0
    rasio_kum_pagu = float(round(kumulatif_cair / float(pagu_alokasi_kontrak), 4)) if float(pagu_alokasi_kontrak) > 0 else 0.0
    rasio_kum_kontrak = float(round(kumulatif_cair / float(nilai_kontrak), 4)) if float(nilai_kontrak) > 0 else 0.0

    penyebut = max(delta_progres / 100.0, 0.005)
    rasio_nilai_vs_prog = float(rasio_nilai_kontrak / penyebut)

    # 3 Fitur Baru
    kelengkapan_bukti = float(transaksi.get("kelengkapan_bukti", 1.0))

    tahap = str(tahap_proyek or transaksi.get("tahap_proyek") or "")
    if not tahap:
        if jenis == "retensi":
            tahap = "pemeliharaan"
        elif curr_progres <= 10:
            tahap = "persiapan"
        elif curr_progres < 90:
            tahap = "konstruksi"
        else:
            tahap = "penyelesaian"

    kategori = str(transaksi.get("kategori_hijau", ""))
    med_ref = cari_median_referensi(kategori, tahap, referensi_kelompok)
    rasio_kelompok = float(curr_nilai / med_ref) if med_ref > 0 else 1.0

    dur = float(durasi_bulan if durasi_bulan is not None else transaksi.get("durasi_bulan", 12.0))
    deviasi_jadwal = hitung_deviasi_jadwal(curr_progres, float(transaksi.get("bulan_ke", 1)), dur)

    fitur = {
        "log_nilai": float(np.log1p(curr_nilai)),
        "rasio_nilai_terhadap_kontrak": rasio_nilai_kontrak,
        "rasio_kumulatif_pagu": rasio_kum_pagu,
        "rasio_kumulatif_kontrak": rasio_kum_kontrak,
        "hari_sejak_pencairan_sebelumnya": float(hari_sejak_prev),
        "delta_progres_pct": float(delta_progres),
        "progres_fisik_pct": float(curr_progres),
        "bulan_ke": float(transaksi.get("bulan_ke", 1)),
        "persetujuan_wajib": float(transaksi.get("persetujuan_wajib", 1)),
        "jenis_uang_muka": 1.0 if jenis == "uang_muka" else 0.0,
        "jenis_termin": 1.0 if jenis == "termin" else 0.0,
        "jenis_retensi": 1.0 if jenis == "retensi" else 0.0,
        "rasio_nilai_vs_progres": rasio_nilai_vs_prog,
        "jumlah_pencairan_7_hari": float(cnt_7d),
        "nilai_vs_median_kontrak": float(nilai_vs_med),
        "kelengkapan_bukti": kelengkapan_bukti,
        "rasio_nilai_vs_median_kelompok": rasio_kelompok,
        "deviasi_jadwal_pct": deviasi_jadwal,
    }

    return {k: fitur[k] for k in DAFTAR_FITUR}
