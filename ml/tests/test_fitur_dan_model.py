"""
ml/tests/test_fitur_dan_model.py
================================
Tes untuk Fase 3:
- Tidak ada kebocoran label pada fitur (label_anomali, kelompok_kasus, subtipe_kasus, split).
- Pembangunan 15 fitur konsisten antara batch DataFrame dan hitung satu transaksi.
- Pelatihan model dan penentuan ambang dari split validasi.
"""

import os
import numpy as np
import pandas as pd
import pytest

from gstp.fitur import DAFTAR_FITUR, bangun_fitur_dataframe, hitung_fitur_satu_transaksi
from gstp.model import (
    c_factor,
    latih_model_isolation_forest,
    hitung_skor_iforest,
    tentukan_ambang_validasi,
)
from gstp.aturan import evaluasi_aturan_dataframe, muat_konfigurasi_aturan

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data_simulasi")


@pytest.fixture(scope="module")
def dataset():
    trx_path = os.path.join(DATA_DIR, "transaksi_gstp.csv")
    prj_path = os.path.join(DATA_DIR, "registri_proyek.csv")
    ktr_path = os.path.join(DATA_DIR, "registri_kontrak.csv")

    df_trx = pd.read_csv(trx_path)
    df_prj = pd.read_csv(prj_path)
    df_ktr = pd.read_csv(ktr_path)
    return df_trx, df_prj, df_ktr


def test_tidak_ada_kebocoran_label():
    """Wajib CLAUDE.md dan MODEL_SPEC.md: Kolom label dan split tidak boleh ada di fitur."""
    kolom_terlarang = {"label_anomali", "kelompok_kasus", "subtipe_kasus", "split"}
    fitur_set = set(DAFTAR_FITUR)
    irisan = fitur_set.intersection(kolom_terlarang)
    assert len(irisan) == 0, f"Fitur mengandung kolom terlarang: {irisan}"
    assert len(DAFTAR_FITUR) == 18, f"Jumlah fitur harus 18, didapat {len(DAFTAR_FITUR)}"


def test_pemisahan_data_per_proyek(dataset):
    """REV-04: Tidak ada proyek atau kontrak yang muncul di lebih dari satu split."""
    df_trx, df_prj, df_ktr = dataset
    peta_ktr_ke_prj = df_ktr.set_index("kontrak_id")["project_id"].to_dict()
    proyek_sebenarnya = df_trx["kontrak_id"].map(peta_ktr_ke_prj)

    split_per_proyek = df_trx.groupby(proyek_sebenarnya)["split"].nunique()
    assert (split_per_proyek == 1).all(), "Ada proyek yang terbelah di lebih dari satu split!"

    split_per_kontrak = df_trx.groupby("kontrak_id")["split"].nunique()
    assert (split_per_kontrak == 1).all(), "Ada kontrak yang terbelah di lebih dari satu split!"


def test_fallback_referensi_kelompok():
    """REV-03: Fallback referensi kelompok: pasangan kategori|tahap -> tahap -> global."""
    from gstp.fitur import cari_median_referensi

    ref = {
        "median_per_kelompok": {"Energi terbarukan|konstruksi": 5_000_000_000},
        "median_per_tahap": {"konstruksi": 4_000_000_000, "persiapan": 2_000_000_000},
        "median_global": 3_000_000_000,
    }

    # 1. Pasangan ada
    assert cari_median_referensi("Energi terbarukan", "konstruksi", ref) == 5_000_000_000
    # 2. Pasangan tidak ada, tahap ada
    assert cari_median_referensi("Transportasi berkelanjutan", "konstruksi", ref) == 4_000_000_000
    # 3. Tahap tidak ada, fallback ke global
    assert cari_median_referensi("Kategori Tidak Ada", "pemeliharaan", ref) == 3_000_000_000


def test_konsistensi_hitung_fitur_satuan(dataset):
    """
    Menguji kesesuaian antara hitung_fitur_satu_transaksi dan bangun_fitur_dataframe
    untuk beberapa transaksi acak dalam dataset.
    """
    from gstp.fitur import hitung_referensi_kelompok
    df_trx, df_prj, df_ktr = dataset

    cfg = muat_konfigurasi_aturan()
    melanggar = evaluasi_aturan_dataframe(df_trx, df_prj, df_ktr, config=cfg)
    ref_kel = hitung_referensi_kelompok(df_trx[(df_trx["split"] == "pengembangan") & (~melanggar)])
    peta_durasi = df_ktr.set_index("kontrak_id")["durasi_bulan"].to_dict()

    df_feat = bangun_fitur_dataframe(df_trx, referensi_kelompok=ref_kel, peta_durasi_kontrak=peta_durasi)

    # Ambil beberapa kontrak dengan jumlah transaksi > 5
    grup = df_trx.groupby("kontrak_id").size()
    sample_kontrak = grup[grup > 5].sample(3, random_state=42).index

    for kid in sample_kontrak:
        sub_df = df_trx[df_trx["kontrak_id"] == kid].sort_values("tanggal").reset_index(drop=True)
        pagu = float(sub_df.iloc[0]["pagu_alokasi_kontrak"])
        nilai_k = float(sub_df.iloc[0]["nilai_kontrak"])
        ktr_row = df_ktr[df_ktr["kontrak_id"] == kid].iloc[0]
        tgl_mulai = ktr_row["tanggal_mulai"]
        durasi_k = float(ktr_row["durasi_bulan"])

        # Uji transaksi ke-2 (ada riwayat)
        pos = 2
        trx_dict = sub_df.iloc[pos].to_dict()
        riwayat = [sub_df.iloc[i].to_dict() for i in range(pos)]

        f_single = hitung_fitur_satu_transaksi(
            trx_dict, riwayat, pagu, nilai_k,
            tanggal_mulai_kontrak=tgl_mulai,
            referensi_kelompok=ref_kel,
            durasi_bulan=durasi_k,
            tahap_proyek=str(trx_dict.get("tahap_proyek", "")),
        )

        original_idx = df_trx[(df_trx["kontrak_id"] == kid) & (df_trx["trx_id"] == trx_dict["trx_id"])].index[0]
        row_feat = df_feat.iloc[original_idx]

        for f_name in DAFTAR_FITUR:
            val_single = f_single[f_name]
            val_batch = float(row_feat[f_name])
            assert abs(val_single - val_batch) < 1e-4, (
                f"Selisih fitur {f_name}: single={val_single}, batch={val_batch}"
            )


def test_c_factor():
    assert c_factor(0) == 0.0
    assert c_factor(1) == 0.0
    assert c_factor(2) == 1.0
    c_256 = c_factor(256)
    assert 10.2 < c_256 < 10.3


def test_latih_dan_tentukan_ambang(dataset):
    """
    DoD Fase 3 / R5:
    - Model dilatih pada split 'pengembangan', baris lolos aturan, tanpa label.
    - Ambang ditentukan dari split 'validasi' lolos aturan.
    - Laju false alarm validasi <= 2%.
    """
    from gstp.fitur import hitung_referensi_kelompok
    df_trx, df_prj, df_ktr = dataset
    cfg = muat_konfigurasi_aturan()

    # Identifikasi baris melanggar aturan
    melanggar = evaluasi_aturan_dataframe(df_trx, df_prj, df_ktr, config=cfg)
    df_dev_lolos = df_trx[(df_trx["split"] == "pengembangan") & (~melanggar)]
    ref_kel = hitung_referensi_kelompok(df_dev_lolos)
    peta_durasi = df_ktr.set_index("kontrak_id")["durasi_bulan"].to_dict()

    df_lolos = df_trx[~melanggar].copy().reset_index(drop=True)

    # Ekstraksi fitur untuk seluruh data lolos
    X_all = bangun_fitur_dataframe(df_lolos, referensi_kelompok=ref_kel, peta_durasi_kontrak=peta_durasi)

    # Filter split
    mask_dev = (df_lolos["split"] == "pengembangan").values
    mask_val = (df_lolos["split"] == "validasi").values

    X_train = X_all.values[mask_dev]
    X_val = X_all.values[mask_val]
    y_val = df_lolos.loc[mask_val, "label_anomali"].values

    assert X_train.shape[1] == 18
    assert len(X_train) > 0
    assert len(X_val) > 0

    # Latih model
    model = latih_model_isolation_forest(X_train, seed=42)

    # Hitung skor pada validasi
    skor_val = hitung_skor_iforest(model, X_val)
    assert skor_val.min() >= 0.0
    assert skor_val.max() <= 1.0

    # Tentukan ambang
    ambang, f1_val, far_val = tentukan_ambang_validasi(skor_val, y_val, max_far=0.02)

    assert 0.0 < ambang < 1.0
    assert far_val <= 0.02, f"FAR validasi harus <= 0.02, didapat {far_val}"
    assert f1_val >= 0.0
    assert f1_val >= 0.0
