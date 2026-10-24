#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_gstp_data.py
=====================
Generator data simulasi untuk prototipe Green Sukuk Traceability Protocol (GSTP).

PENTING: seluruh angka, nama proyek, dan kode seri bersifat ILUSTRATIF. Data ini
BUKAN data riil Kementerian Keuangan atau kementerian pelaksana. Parameter
simulasi adalah asumsi penulis dan harus disebut demikian di esai.

Keluaran (folder --out-dir):
  transaksi_gstp.csv     satu baris = satu pencairan (data utama untuk model)
  registri_proyek.csv    master proyek (padanan Allocation Register)
  registri_kontrak.csv   master kontrak, pagu alokasi, uang muka, retensi
  metadata_simulasi.json parameter, definisi label, dan ringkasan jumlah data

Jenis kasus pada kolom `kelompok_kasus` dan `subtipe_kasus`:
  normal                  : pencairan biasa
  normal_tidak_lazim_sah  : tampak janggal tetapi sah (uang muka, retensi,
                            percepatan akhir tahun, penyesuaian addendum)
  anomali_aturan          : pelanggaran aturan jelas (dapat dicek rule engine)
    id_proyek_tidak_valid, melebihi_pagu, persetujuan_wajib_hilang,
    kategori_tidak_memenuhi_syarat, hash_tidak_cocok,
    milestone_belum_terverifikasi, bukti_wajib_hilang
  anomali_kontekstual     : kejanggalan yang lolos aturan tetapi tidak wajar
    lonjakan_tanpa_progres, pemecahan_pencairan, progres_stagnan_tapi_cair,
    pencairan_setelah_selesai

Kolom `split` memisahkan data berdasarkan waktu:
  pengembangan (60% awal), validasi (20% berikutnya), pengujian (20% terakhir).

Cara pakai:
  python generate_gstp_data.py
  python generate_gstp_data.py --n-proyek 1200 --seed 7 --tingkat-anomali 0.04
  python generate_gstp_data.py --out-dir data_simulasi

Kebutuhan: Python 3.9+, numpy, pandas.
"""

import argparse
import hashlib
import json
import os

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Konfigurasi umum
# ---------------------------------------------------------------------------
DATA_END = pd.Timestamp("2026-09-30")  # batas akhir data simulasi

SERI = {
    "SERI-2021": {"terbit": "2021-03-15", "akad": "Ijarah Asset to Be Leased"},
    "SERI-2022": {"terbit": "2022-03-15", "akad": "Ijarah Asset to Be Leased"},
    "SERI-2023": {"terbit": "2023-03-15", "akad": "Wakalah"},
    "SERI-2024": {"terbit": "2024-03-15", "akad": "Wakalah"},
}
BOBOT_SERI = [0.20, 0.25, 0.30, 0.25]

# kategori hijau: (kementerian pelaksana, bobot kemunculan)
KATEGORI = {
    "Ketahanan terhadap perubahan iklim": ("Kementerian PUPR", 0.30),
    "Transportasi berkelanjutan": ("Kementerian Perhubungan", 0.20),
    "Pengelolaan air dan air limbah": ("Kementerian PUPR", 0.15),
    "Energi terbarukan": ("Kementerian ESDM", 0.10),
    "Efisiensi energi": ("Kementerian ESDM", 0.07),
    "Bangunan hijau": ("Kementerian PUPR", 0.06),
    "Pertanian berkelanjutan": ("Kementerian Pertanian", 0.07),
    "Pengelolaan sumber daya alam dan lahan": ("Kementerian LHK", 0.05),
}
KATEGORI_TIDAK_MEMENUHI = [
    "Non-hijau (umum)",
    "Belanja operasional kantor",
    "Belanja pegawai",
]

# ambang persetujuan berjenjang (rupiah)
AMBANG_2_PERSETUJUAN = 1_000_000_000
AMBANG_3_PERSETUJUAN = 5_000_000_000

# bobot jumlah anomali
BOBOT_ATURAN = {
    "id_proyek_tidak_valid": 0.12,
    "melebihi_pagu": 0.08,
    "persetujuan_wajib_hilang": 0.20,
    "kategori_tidak_memenuhi_syarat": 0.12,
    "hash_tidak_cocok": 0.18,
    "milestone_belum_terverifikasi": 0.15,
    "bukti_wajib_hilang": 0.15,
}
BOBOT_KONTEKSTUAL = {
    "lonjakan_tanpa_progres": 0.35,
    "pemecahan_pencairan": 0.20,
    "progres_stagnan_tapi_cair": 0.30,
    "pencairan_setelah_selesai": 0.15,
}
PORSI_ATURAN = 0.50  # separuh anomali aturan, separuh kontekstual


# ---------------------------------------------------------------------------
# Utilitas
# ---------------------------------------------------------------------------
def sha16(teks: str) -> str:
    """SHA-256 dipotong 16 heksadesimal (cukup untuk simulasi)."""
    return hashlib.sha256(teks.encode("utf-8")).hexdigest()[:16]


def urutkan(df: pd.DataFrame) -> pd.DataFrame:
    return (
        df.sort_values(["kontrak_id", "tanggal"], kind="mergesort")
        .reset_index(drop=True)
    )


def tandai(df, idx, kelompok, subtipe):
    df.loc[idx, "label_anomali"] = 1
    df.loc[idx, "kelompok_kasus"] = kelompok
    df.loc[idx, "subtipe_kasus"] = subtipe


def pilih_kandidat(df, mask, rng, tersentuh=None, unik_kontrak=True):
    """Ambil indeks kandidat secara acak; opsional satu baris per kontrak."""
    idx = df.index[mask].to_numpy()
    if len(idx) == 0:
        return np.array([], dtype=int)
    idx = rng.permutation(idx)
    sub = df.loc[idx]
    if tersentuh:
        sub = sub[~sub["kontrak_id"].isin(list(tersentuh))]
    if unik_kontrak:
        sub = sub.drop_duplicates("kontrak_id")
    return sub.index.to_numpy()


def hitung_target(total, bobot):
    return {k: int(round(total * w)) for k, w in bobot.items()}


# ---------------------------------------------------------------------------
# 1. Registri proyek dan kontrak
# ---------------------------------------------------------------------------
def buat_registri(rng, n_proyek):
    nama_seri = list(SERI)
    nama_kat = list(KATEGORI)
    p_kat = np.array([KATEGORI[k][1] for k in nama_kat])
    p_kat = p_kat / p_kat.sum()

    proyek, kontrak = [], []
    for i in range(n_proyek):
        pid = f"PRJ-{i + 1:04d}"
        seri = str(rng.choice(nama_seri, p=BOBOT_SERI))
        terbit = pd.Timestamp(SERI[seri]["terbit"])
        mulai_proyek = terbit + pd.Timedelta(days=int(rng.integers(0, 366)))
        kat = str(rng.choice(nama_kat, p=p_kat))
        jenis_pembiayaan = (
            "pembiayaan_baru" if rng.random() < 0.70 else "pembiayaan_kembali"
        )

        n_kontrak = int(rng.integers(2, 6))  # 2..5 kontrak per proyek
        pagu_proyek = 0
        for j in range(n_kontrak):
            nilai = float(np.exp(rng.uniform(np.log(2e10), np.log(1.5e12))))
            nilai = int(round(nilai, -6))  # kelipatan Rp1 juta
            durasi = int(rng.integers(10, 31))  # 10..30 bulan
            mulai = mulai_proyek + pd.Timedelta(days=int(rng.integers(0, 121)))
            um = float(rng.choice([0.10, 0.15, 0.20, 0.25]))
            pagu = int(round(nilai * 1.10, -6))  # cadangan 10%
            pagu_proyek += pagu
            kontrak.append(
                {
                    "kontrak_id": f"{pid}-K{j + 1:02d}",
                    "project_id": pid,
                    "nilai_kontrak_awal": nilai,
                    "pagu_alokasi": pagu,
                    "tanggal_mulai": mulai,
                    "durasi_bulan": durasi,
                    "uang_muka_pct": um,
                    "retensi_pct": 0.05,
                }
            )
        proyek.append(
            {
                "project_id": pid,
                "nama_proyek": f"Paket {kat} #{i + 1:04d}",
                "kategori_hijau": kat,
                "kementerian_pelaksana": KATEGORI[kat][0],
                "seri_penerbitan": seri,
                "akad": SERI[seri]["akad"],
                "jenis_pembiayaan": jenis_pembiayaan,
                "tanggal_mulai": mulai_proyek,
                "pagu_proyek": pagu_proyek,
            }
        )
    return pd.DataFrame(proyek), pd.DataFrame(kontrak)


# ---------------------------------------------------------------------------
# 2. Transaksi normal (termasuk kasus tidak lazim tetapi sah)
# ---------------------------------------------------------------------------
def bangun_transaksi_normal(rng, reg_proyek, reg_kontrak):
    info_proyek = reg_proyek.set_index("project_id")
    baris = []

    for k in reg_kontrak.itertuples(index=False):
        D = int(k.durasi_bulan)
        start = k.tanggal_mulai
        nilai0 = float(k.nilai_kontrak_awal)
        um, ret = float(k.uang_muka_pct), float(k.retensi_pct)

        # --- kurva-S progres fisik ---
        kk = rng.uniform(6, 10)
        x = np.arange(0, D + 1) / D
        s = 1.0 / (1.0 + np.exp(-kk * (x - 0.5)))
        s = (s - s[0]) / (s[-1] - s[0])
        inc = np.diff(s) * rng.lognormal(0.0, 0.15, size=D)

        tgl_bulan = [
            start
            + pd.DateOffset(months=m)
            + pd.Timedelta(days=int(rng.integers(0, 6)))
            for m in range(1, D + 1)
        ]
        # percepatan akhir tahun (sah, progres naik dan terverifikasi)
        boost = np.ones(D)
        for m in range(D):
            if tgl_bulan[m].month in (11, 12) and rng.random() < 0.30:
                boost[m] = rng.uniform(1.4, 1.9)
        inc = inc * boost
        inc = inc / inc.sum()
        prog = np.cumsum(inc)  # progres kumulatif, berakhir di 1.0

        # --- addendum disetujui (sah) ---
        ada_add = (D >= 12) and (rng.random() < 0.12)
        if ada_add:
            m_add = int(rng.integers(int(0.3 * D), int(0.7 * D) + 1))
            m_add = max(m_add, 2)
            nilai1 = nilai0 * (1.0 + rng.uniform(0.03, 0.08))
        else:
            m_add, nilai1 = 10**9, nilai0

        pr = info_proyek.loc[k.project_id]

        def dasar(tanggal, jenis, bulan_ke, progres, nilai, nilai_k, versi, subtipe):
            return {
                "kontrak_id": k.kontrak_id,
                "project_id": k.project_id,
                "tanggal": tanggal,
                "jenis_pembayaran": jenis,
                "bulan_ke": bulan_ke,
                "nilai_pencairan": float(nilai),
                "nilai_kontrak": int(round(nilai_k)),
                "versi_kontrak": versi,
                "status_addendum": "disetujui" if versi > 1 else "tidak_ada",
                "pagu_alokasi_kontrak": int(k.pagu_alokasi),
                "progres_fisik_pct": round(float(progres) * 100.0, 2),
                "seri_penerbitan": pr["seri_penerbitan"],
                "akad": pr["akad"],
                "jenis_pembiayaan": pr["jenis_pembiayaan"],
                "kategori_hijau": pr["kategori_hijau"],
                "kementerian_pelaksana": pr["kementerian_pelaksana"],
                "_subtipe_normal": subtipe,
            }

        # uang muka (sah: nilai besar saat progres 0)
        t_um = start + pd.Timedelta(days=int(rng.integers(3, 11)))
        baris.append(dasar(t_um, "uang_muka", 0, 0.0, um * nilai0, nilai0, 1, "uang_muka"))

        # termin bulanan
        for m in range(1, D + 1):
            pakai_baru = m >= m_add
            nilai_k = nilai1 if pakai_baru else nilai0
            versi = 2 if pakai_baru else 1
            bayar = nilai_k * inc[m - 1] * (1.0 - um - ret) * rng.lognormal(0.0, 0.03)
            subtipe = "biasa"
            if boost[m - 1] > 1.0:
                subtipe = "akhir_tahun_dipercepat"
            if m == m_add:
                p_sebelum = prog[m - 2] if m >= 2 else 0.0
                bayar += (nilai1 - nilai0) * (1.0 - um - ret) * p_sebelum
                subtipe = "penyesuaian_addendum"
            baris.append(
                dasar(tgl_bulan[m - 1], "termin", m, prog[m - 1], bayar, nilai_k, versi, subtipe)
            )

        # retensi (sah: dibayar setelah selesai, progres tetap 100%)
        t_ret = tgl_bulan[-1] + pd.Timedelta(days=90)
        baris.append(
            dasar(t_ret, "retensi", D + 3, 1.0, ret * nilai1, nilai1, 2 if ada_add else 1, "retensi")
        )

    df = pd.DataFrame(baris)
    df = df[df["tanggal"] <= DATA_END].copy()
    df["label_anomali"] = 0
    df["kelompok_kasus"] = np.where(
        df["_subtipe_normal"] == "biasa", "normal", "normal_tidak_lazim_sah"
    )
    df["subtipe_kasus"] = df["_subtipe_normal"]
    df = df.drop(columns=["_subtipe_normal"])
    return urutkan(df)


# ---------------------------------------------------------------------------
# 3. Anomali kontekstual dan pengubah nilai
# ---------------------------------------------------------------------------
def suntik_lonjakan(df, rng, target, tersentuh):
    """Pencairan dipercepat tanpa kenaikan progres. Total kontrak dijaga
    (pencairan berikutnya dikurangi) sehingga tidak melanggar pagu."""
    df = urutkan(df)
    df["_t"] = (df["jenis_pembayaran"] == "termin").astype(int)
    grp = df.groupby("kontrak_id")["_t"]
    df["_sisa"] = grp.transform("sum") - grp.cumsum()
    mask = (
        (df["_t"] == 1)
        & (df["subtipe_kasus"] == "biasa")
        & (df["_sisa"] >= 2)
        & (df["bulan_ke"] >= 3)
    )
    cand = pilih_kandidat(df, mask, rng, tersentuh)
    n = 0
    for i in cand:
        if n >= target:
            break
        kid = df.at[i, "kontrak_id"]
        later = df.index[
            (df["kontrak_id"] == kid) & (df["_t"] == 1) & (df.index > i)
        ]
        v = float(df.at[i, "nilai_pencairan"])
        extra = v * (rng.uniform(3.0, 6.0) - 1.0)
        sum_later = float(df.loc[later, "nilai_pencairan"].sum())
        extra = min(extra, 0.7 * sum_later)
        if extra < 1.5 * v:
            continue
        df.at[i, "nilai_pencairan"] = v + extra
        df.loc[later, "nilai_pencairan"] = df.loc[later, "nilai_pencairan"] * (
            1.0 - extra / sum_later
        )
        tandai(df, [i], "anomali_kontekstual", "lonjakan_tanpa_progres")
        tersentuh.add(kid)
        n += 1
    return urutkan(df), n


def suntik_pemecahan(df, rng, target, tersentuh):
    """Satu pencairan besar dipecah menjadi beberapa pencairan tepat di bawah
    ambang 3 persetujuan dalam beberapa hari. Total tetap."""
    df = urutkan(df)
    mask = (
        (df["jenis_pembayaran"] == "termin")
        & (df["subtipe_kasus"] == "biasa")
        & (df["nilai_pencairan"].between(5.3e9, 19.5e9))
    )
    cand = pilih_kandidat(df, mask, rng, tersentuh)
    blok_baru, n_baris = [], 0
    for i in cand:
        if n_baris >= target:
            break
        v = float(df.at[i, "nilai_pencairan"])
        n = int(np.ceil(v / 4.9e9))
        if n < 2:
            continue
        bagian = (v / n) * rng.uniform(0.98, 1.02, size=n)
        bagian = bagian * (v / bagian.sum())
        if bagian.max() >= 4.99e9:
            bagian = np.full(n, v / n)
        tgl = df.at[i, "tanggal"]
        offset = np.cumsum(rng.integers(0, 3, size=n))
        offset = offset - offset[0]
        blok = pd.concat([df.loc[[i]]] * (n - 1), ignore_index=True)
        blok["nilai_pencairan"] = bagian[1:]
        blok["tanggal"] = [
            min(tgl + pd.Timedelta(days=int(o)), DATA_END) for o in offset[1:]
        ]
        blok["label_anomali"] = 1
        blok["kelompok_kasus"] = "anomali_kontekstual"
        blok["subtipe_kasus"] = "pemecahan_pencairan"
        df.at[i, "nilai_pencairan"] = bagian[0]
        tandai(df, [i], "anomali_kontekstual", "pemecahan_pencairan")
        blok_baru.append(blok)
        tersentuh.add(df.at[i, "kontrak_id"])
        n_baris += n
    if blok_baru:
        df = pd.concat([df] + blok_baru, ignore_index=True)
    return urutkan(df), n_baris


def suntik_stagnan(df, rng, target, tersentuh):
    """Progres yang dilaporkan stagnan 2-3 bulan, tetapi pencairan jalan terus."""
    df = urutkan(df)
    mask_t = df["jenis_pembayaran"] == "termin"
    grup = df.loc[mask_t].groupby("kontrak_id").groups
    kunci = np.array(sorted(grup.keys()))
    kunci = rng.permutation(kunci)
    n_baris = 0
    for kid in kunci:
        if n_baris >= target:
            break
        if kid in tersentuh:
            continue
        idx = list(grup[kid])
        if len(idx) < 8:
            continue
        s = int(rng.integers(2, len(idx) - 4))
        k = int(rng.integers(2, 4))  # 2 atau 3 baris
        baris = idx[s : s + k]
        if any(df.at[b, "subtipe_kasus"] != "biasa" for b in baris):
            continue
        datar = df.at[idx[s - 1], "progres_fisik_pct"]
        df.loc[baris, "progres_fisik_pct"] = datar
        tandai(df, baris, "anomali_kontekstual", "progres_stagnan_tapi_cair")
        tersentuh.add(kid)
        n_baris += k
    return urutkan(df), n_baris


def suntik_setelah_selesai(df, rng, target, tersentuh):
    """Pencairan tambahan setelah retensi dibayar (progres sudah 100%)."""
    df = urutkan(df)
    total = df.groupby("kontrak_id")["nilai_pencairan"].sum()
    mask = df["jenis_pembayaran"] == "retensi"
    cand = pilih_kandidat(df, mask, rng, tersentuh)
    baru, n = [], 0
    for i in cand:
        if n >= target:
            break
        r = df.loc[[i]].copy()
        kid = r["kontrak_id"].iloc[0]
        pagu = float(r["pagu_alokasi_kontrak"].iloc[0])
        nilai_k = float(r["nilai_kontrak"].iloc[0])
        sisa_pagu = pagu - float(total[kid])
        nilai = min(nilai_k * rng.uniform(0.01, 0.04), 0.8 * sisa_pagu)
        if nilai < 0.005 * nilai_k:
            continue
        tgl = r["tanggal"].iloc[0] + pd.Timedelta(days=int(rng.integers(20, 121)))
        if tgl > DATA_END:
            continue
        r["tanggal"] = tgl
        r["jenis_pembayaran"] = "termin"
        r["nilai_pencairan"] = nilai
        r["progres_fisik_pct"] = 100.0
        r["bulan_ke"] = int(r["bulan_ke"].iloc[0]) + 2
        tandai(r, r.index, "anomali_kontekstual", "pencairan_setelah_selesai")
        baru.append(r)
        tersentuh.add(kid)
        n += 1
    if baru:
        df = pd.concat([df] + baru, ignore_index=True)
    return urutkan(df), n


def suntik_melebihi_pagu(df, rng, target, tersentuh):
    """Pelanggaran aturan: pencairan terakhir membuat kumulatif melewati pagu."""
    df = urutkan(df)
    total = df.groupby("kontrak_id")["nilai_pencairan"].sum()
    mask = df["jenis_pembayaran"] == "retensi"
    cand = pilih_kandidat(df, mask, rng, tersentuh)
    n = 0
    for i in cand:
        if n >= target:
            break
        kid = df.at[i, "kontrak_id"]
        pagu = float(df.at[i, "pagu_alokasi_kontrak"])
        sebelum = float(total[kid]) - float(df.at[i, "nilai_pencairan"])
        lebih = pagu * rng.uniform(0.01, 0.08)
        df.at[i, "nilai_pencairan"] = pagu - sebelum + lebih
        tandai(df, [i], "anomali_aturan", "melebihi_pagu")
        tersentuh.add(kid)
        n += 1
    return urutkan(df), n


# ---------------------------------------------------------------------------
# 4. Fitur turunan (hanya memakai informasi yang sudah ada saat transaksi)
# ---------------------------------------------------------------------------
def tambah_fitur_turunan(df, reg_kontrak):
    df = urutkan(df)
    g = df.groupby("kontrak_id", sort=False)
    mulai = df["kontrak_id"].map(reg_kontrak.set_index("kontrak_id")["tanggal_mulai"])
    sebelumnya = g["tanggal"].shift(1)
    df["hari_sejak_pencairan_sebelumnya"] = (
        (df["tanggal"] - sebelumnya.fillna(mulai)).dt.days.astype(int)
    )
    df["kumulatif_cair"] = g["nilai_pencairan"].cumsum()
    df["rasio_kumulatif_pagu"] = (
        df["kumulatif_cair"] / df["pagu_alokasi_kontrak"]
    ).round(4)
    df["rasio_kumulatif_kontrak"] = (
        df["kumulatif_cair"] / df["nilai_kontrak"]
    ).round(4)
    df["rasio_nilai_terhadap_kontrak"] = (
        df["nilai_pencairan"] / df["nilai_kontrak"]
    ).round(5)
    prog_sebelum = g["progres_fisik_pct"].shift(1).fillna(0.0)
    df["delta_progres_pct"] = (df["progres_fisik_pct"] - prog_sebelum).round(2)
    return df


# ---------------------------------------------------------------------------
# 5. Anomali pelanggaran aturan (tanpa mengubah nilai)
# ---------------------------------------------------------------------------
def suntik_aturan(df, rng, target_tipe):
    pool = df.index[(df["label_anomali"] == 0) & (df["subtipe_kasus"] == "biasa")]
    pool = rng.permutation(pool.to_numpy())
    diambil = set()
    hasil = {}

    def ambil(n, hanya_termin=False):
        out = []
        for i in pool:
            if len(out) >= n:
                break
            if i in diambil:
                continue
            if hanya_termin and df.at[i, "jenis_pembayaran"] != "termin":
                continue
            out.append(i)
            diambil.add(i)
        return np.array(out, dtype=int)

    # 1. id proyek tidak valid
    idx = ambil(target_tipe.get("id_proyek_tidak_valid", 0))
    if len(idx):
        df.loc[idx, "project_id"] = [
            f"PRJ-{x}" for x in rng.integers(9000, 10000, size=len(idx))
        ]
        tandai(df, idx, "anomali_aturan", "id_proyek_tidak_valid")
    hasil["id_proyek_tidak_valid"] = len(idx)

    # 2. persetujuan wajib hilang
    idx = ambil(target_tipe.get("persetujuan_wajib_hilang", 0))
    if len(idx):
        kurang = np.where(rng.random(len(idx)) < 0.7, 1, 99)
        baru = np.maximum(df.loc[idx, "persetujuan_wajib"].to_numpy() - kurang, 0)
        df.loc[idx, "persetujuan_diperoleh"] = baru
        tandai(df, idx, "anomali_aturan", "persetujuan_wajib_hilang")
    hasil["persetujuan_wajib_hilang"] = len(idx)

    # 3. kategori tidak memenuhi syarat
    idx = ambil(target_tipe.get("kategori_tidak_memenuhi_syarat", 0))
    if len(idx):
        df.loc[idx, "kategori_hijau"] = rng.choice(KATEGORI_TIDAK_MEMENUHI, size=len(idx))
        tandai(df, idx, "anomali_aturan", "kategori_tidak_memenuhi_syarat")
    hasil["kategori_tidak_memenuhi_syarat"] = len(idx)

    # 4. hash dokumen tidak cocok
    idx = ambil(target_tipe.get("hash_tidak_cocok", 0))
    if len(idx):
        df.loc[idx, "hash_dokumen_saat_ini"] = [
            sha16(f"{t}|dimodifikasi|{i}")
            for t, i in zip(df.loc[idx, "hash_tercatat"], idx)
        ]
        tandai(df, idx, "anomali_aturan", "hash_tidak_cocok")
    hasil["hash_tidak_cocok"] = len(idx)

    # 5. milestone belum terverifikasi (hanya termin)
    idx = ambil(target_tipe.get("milestone_belum_terverifikasi", 0), hanya_termin=True)
    if len(idx):
        df.loc[idx, "milestone_terverifikasi"] = False
        tandai(df, idx, "anomali_aturan", "milestone_belum_terverifikasi")
    hasil["milestone_belum_terverifikasi"] = len(idx)

    # 6. bukti wajib hilang
    idx = ambil(target_tipe.get("bukti_wajib_hilang", 0))
    if len(idx):
        df.loc[idx, "kelengkapan_bukti"] = rng.uniform(0.10, 0.70, size=len(idx)).round(2)
        tandai(df, idx, "anomali_aturan", "bukti_wajib_hilang")
    hasil["bukti_wajib_hilang"] = len(idx)
    return df, hasil


# ---------------------------------------------------------------------------
# 6. Uji kewarasan: apakah aturan sederhana menangkap kelompok yang benar?
# ---------------------------------------------------------------------------
def tandai_dengan_aturan(df, reg_proyek, reg_kontrak):
    proyek_sah = set(reg_proyek["project_id"])
    peta_kontrak = reg_kontrak.set_index("kontrak_id")["project_id"]
    kategori_sah = set(KATEGORI)
    r1 = ~df["project_id"].isin(proyek_sah) | (
        df["project_id"] != df["kontrak_id"].map(peta_kontrak)
    )
    r2 = df["kumulatif_cair"] > df["pagu_alokasi_kontrak"]
    r3 = df["persetujuan_diperoleh"] < df["persetujuan_wajib"]
    r4 = ~df["kategori_hijau"].isin(kategori_sah)
    r5 = df["hash_tercatat"] != df["hash_dokumen_saat_ini"]
    r6 = (~df["milestone_terverifikasi"]) & (df["jenis_pembayaran"] == "termin")
    r7 = df["kelengkapan_bukti"] < 0.80
    return r1 | r2 | r3 | r4 | r5 | r6 | r7


# ---------------------------------------------------------------------------
# Program utama
# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="Generator data simulasi GSTP")
    ap.add_argument("--n-proyek", type=int, default=800, help="jumlah proyek (default 800)")
    ap.add_argument("--seed", type=int, default=42, help="seed acak (default 42)")
    ap.add_argument(
        "--tingkat-anomali",
        type=float,
        default=0.03,
        help="proporsi anomali terhadap seluruh baris (default 0.03)",
    )
    ap.add_argument("--out-dir", default="data_simulasi", help="folder keluaran")
    args = ap.parse_args()

    rng = np.random.default_rng(args.seed)
    os.makedirs(args.out_dir, exist_ok=True)

    print("1/6 Membuat registri proyek dan kontrak ...")
    reg_proyek, reg_kontrak = buat_registri(rng, args.n_proyek)

    print("2/6 Membuat transaksi normal ...")
    df = bangun_transaksi_normal(rng, reg_proyek, reg_kontrak)
    n_normal = len(df)

    total_anomali = int(round(args.tingkat_anomali * n_normal / (1 - args.tingkat_anomali)))
    t_aturan = int(round(total_anomali * PORSI_ATURAN))
    t_kons = total_anomali - t_aturan
    tgt_aturan = hitung_target(t_aturan, BOBOT_ATURAN)
    tgt_kons = hitung_target(t_kons, BOBOT_KONTEKSTUAL)

    print("3/6 Menyuntikkan anomali pengubah nilai ...")
    tersentuh = set()
    df, n_lonjakan = suntik_lonjakan(df, rng, tgt_kons["lonjakan_tanpa_progres"], tersentuh)
    df, n_pecah = suntik_pemecahan(df, rng, tgt_kons["pemecahan_pencairan"], tersentuh)
    df, n_stagnan = suntik_stagnan(df, rng, tgt_kons["progres_stagnan_tapi_cair"], tersentuh)
    df, n_selesai = suntik_setelah_selesai(df, rng, tgt_kons["pencairan_setelah_selesai"], tersentuh)
    df, n_pagu = suntik_melebihi_pagu(df, rng, tgt_aturan["melebihi_pagu"], tersentuh)

    print("4/6 Menghitung fitur turunan, persetujuan, bukti, dan hash ...")
    df["nilai_pencairan"] = df["nilai_pencairan"].round().astype("int64")
    df = tambah_fitur_turunan(df, reg_kontrak)
    df = df.drop(columns=[c for c in ("_t", "_sisa") if c in df.columns])

    df = df.sort_values(["tanggal", "kontrak_id"], kind="mergesort").reset_index(drop=True)
    df.insert(0, "trx_id", [f"TRX-{i + 1:06d}" for i in range(len(df))])

    n = len(df)
    nilai = df["nilai_pencairan"]
    df["persetujuan_wajib"] = np.select(
        [nilai < AMBANG_2_PERSETUJUAN, nilai < AMBANG_3_PERSETUJUAN], [1, 2], default=3
    )
    df["persetujuan_diperoleh"] = df["persetujuan_wajib"]
    df["milestone_terverifikasi"] = True
    df["kelengkapan_bukti"] = np.where(
        rng.random(n) < 0.70, 1.0, rng.uniform(0.92, 1.0, size=n)
    ).round(2)
    df["hash_tercatat"] = [
        sha16(f"{args.seed}|{t}|{k}|{v}|{d:%Y-%m-%d}")
        for t, k, v, d in zip(df["trx_id"], df["kontrak_id"], df["nilai_pencairan"], df["tanggal"])
    ]
    df["hash_dokumen_saat_ini"] = df["hash_tercatat"]

    print("5/6 Menyuntikkan anomali pelanggaran aturan ...")
    sisa_aturan = max(t_aturan - n_pagu, 0)
    bobot_sisa = {k: w for k, w in BOBOT_ATURAN.items() if k != "melebihi_pagu"}
    jumlah_w = sum(bobot_sisa.values())
    tgt_sisa = {k: int(round(sisa_aturan * w / jumlah_w)) for k, w in bobot_sisa.items()}
    df, n_aturan = suntik_aturan(df, rng, tgt_sisa)
    n_aturan["melebihi_pagu"] = n_pagu

    # kolom tambahan
    p = df["progres_fisik_pct"]
    df["tahap_proyek"] = np.select(
        [df["jenis_pembayaran"] == "retensi", p <= 10, p < 90],
        ["pemeliharaan", "persiapan", "konstruksi"],
        default="penyelesaian",
    )
    c1, c2 = df["tanggal"].quantile([0.60, 0.80])
    df["split"] = np.select(
        [df["tanggal"] <= c1, df["tanggal"] <= c2],
        ["pengembangan", "validasi"],
        default="pengujian",
    )

    kolom = [
        "trx_id", "tanggal", "seri_penerbitan", "akad", "jenis_pembiayaan",
        "project_id", "kontrak_id", "kementerian_pelaksana", "kategori_hijau",
        "jenis_pembayaran", "bulan_ke", "tahap_proyek",
        "nilai_pencairan", "nilai_kontrak", "versi_kontrak", "status_addendum",
        "pagu_alokasi_kontrak", "progres_fisik_pct", "milestone_terverifikasi",
        "persetujuan_wajib", "persetujuan_diperoleh", "kelengkapan_bukti",
        "hash_tercatat", "hash_dokumen_saat_ini",
        "hari_sejak_pencairan_sebelumnya", "delta_progres_pct",
        "kumulatif_cair", "rasio_kumulatif_pagu", "rasio_kumulatif_kontrak",
        "rasio_nilai_terhadap_kontrak",
        "split", "label_anomali", "kelompok_kasus", "subtipe_kasus",
    ]
    df = df[kolom]

    # --- uji kewarasan ---
    ditandai = tandai_dengan_aturan(df, reg_proyek, reg_kontrak)
    kel = df["kelompok_kasus"]
    cek = {
        "normal_ditandai_aturan": int(ditandai[kel.isin(["normal", "normal_tidak_lazim_sah"])].sum()),
        "anomali_aturan_tertangkap": int(ditandai[kel == "anomali_aturan"].sum()),
        "anomali_aturan_total": int((kel == "anomali_aturan").sum()),
        "anomali_kontekstual_tertangkap": int(ditandai[kel == "anomali_kontekstual"].sum()),
        "anomali_kontekstual_total": int((kel == "anomali_kontekstual").sum()),
    }

    print("6/6 Menyimpan berkas ...")
    out = df.copy()
    out["tanggal"] = out["tanggal"].dt.strftime("%Y-%m-%d")
    out.to_csv(os.path.join(args.out_dir, "transaksi_gstp.csv"), index=False, encoding="utf-8")

    rp = reg_proyek.copy()
    rp["tanggal_mulai"] = rp["tanggal_mulai"].dt.strftime("%Y-%m-%d")
    rp.to_csv(os.path.join(args.out_dir, "registri_proyek.csv"), index=False, encoding="utf-8")
    rk = reg_kontrak.copy()
    rk["tanggal_mulai"] = rk["tanggal_mulai"].dt.strftime("%Y-%m-%d")
    rk.to_csv(os.path.join(args.out_dir, "registri_kontrak.csv"), index=False, encoding="utf-8")

    ringkas = (
        df.groupby(["kelompok_kasus", "subtipe_kasus"]).size().rename("jumlah").reset_index()
    )
    meta = {
        "catatan": "Data simulasi ilustratif; bukan data riil Kemenkeu.",
        "parameter": {
            "n_proyek": args.n_proyek,
            "seed": args.seed,
            "tingkat_anomali_target": args.tingkat_anomali,
            "tanggal_akhir_data": str(DATA_END.date()),
        },
        "jumlah": {
            "proyek": int(len(reg_proyek)),
            "kontrak": int(len(reg_kontrak)),
            "transaksi": int(len(df)),
            "anomali": int(df["label_anomali"].sum()),
            "tingkat_anomali_aktual": round(float(df["label_anomali"].mean()), 4),
        },
        "kategori_hijau_memenuhi_syarat": list(KATEGORI),
        "kategori_tidak_memenuhi_syarat": KATEGORI_TIDAK_MEMENUHI,
        "ambang_persetujuan_rupiah": {
            "2_persetujuan_mulai": AMBANG_2_PERSETUJUAN,
            "3_persetujuan_mulai": AMBANG_3_PERSETUJUAN,
        },
        "batas_split": {"pengembangan_sampai": str(c1.date()), "validasi_sampai": str(c2.date())},
        "label": {
            "label_anomali": "1 jika pencairan disuntik sebagai anomali, 0 jika normal",
            "kelompok_kasus": "normal | normal_tidak_lazim_sah | anomali_aturan | anomali_kontekstual",
        },
        "peringatan_fitur": (
            "Jangan pakai label_anomali, kelompok_kasus, subtipe_kasus, atau split "
            "sebagai fitur model. Kolom turunan hanya memakai informasi yang sudah "
            "ada saat transaksi diperiksa."
        ),
        "uji_kewarasan_aturan": cek,
        "rincian_kasus": ringkas.to_dict(orient="records"),
    }
    with open(os.path.join(args.out_dir, "metadata_simulasi.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    # --- ringkasan ke layar ---
    print("\n=== RINGKASAN ===")
    print(f"Proyek    : {len(reg_proyek):,}")
    print(f"Kontrak   : {len(reg_kontrak):,}")
    print(f"Transaksi : {len(df):,}")
    print(f"Anomali   : {int(df['label_anomali'].sum()):,} ({df['label_anomali'].mean():.2%})")
    print("\nJumlah per kelompok dan subtipe:")
    print(ringkas.to_string(index=False))
    print("\nAnomali per split:")
    print(
        pd.crosstab(df["split"], df["label_anomali"])
        .reindex(["pengembangan", "validasi", "pengujian"])
        .to_string()
    )
    print("\nUji kewarasan (aturan sederhana pada data hasil simulasi):")
    print(f"  Normal yang salah ditandai aturan        : {cek['normal_ditandai_aturan']} (harus 0)")
    print(
        f"  Anomali aturan yang tertangkap aturan    : "
        f"{cek['anomali_aturan_tertangkap']}/{cek['anomali_aturan_total']} (harus semua)"
    )
    print(
        f"  Anomali kontekstual yang tertangkap aturan: "
        f"{cek['anomali_kontekstual_tertangkap']}/{cek['anomali_kontekstual_total']} (harus 0)"
    )
    print(f"\nBerkas tersimpan di folder: {os.path.abspath(args.out_dir)}")


if __name__ == "__main__":
    main()
