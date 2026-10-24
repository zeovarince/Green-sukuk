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
    assert len(DAFTAR_FITUR) == 15, f"Jumlah fitur harus 15, didapat {len(DAFTAR_FITUR)}"


def test_konsistensi_hitung_fitur_satuan(dataset):
    """
    Menguji kesesuaian antara hitung_fitur_satu_transaksi dan bangun_fitur_dataframe
    untuk beberapa transaksi acak dalam dataset.
    """
    df_trx, df_prj, df_ktr = dataset
    df_feat = bangun_fitur_dataframe(df_trx)

    # Ambil beberapa kontrak dengan jumlah transaksi > 5
    grup = df_trx.groupby("kontrak_id").size()
    sample_kontrak = grup[grup > 5].sample(3, random_state=42).index

    for kid in sample_kontrak:
        sub_df = df_trx[df_trx["kontrak_id"] == kid].sort_values("tanggal").reset_index(drop=True)
        # Ambil pagu dan nilai_kontrak dari transaksi atau registri_kontrak
        pagu = float(sub_df.iloc[0]["pagu_alokasi_kontrak"])
        nilai_k = float(sub_df.iloc[0]["nilai_kontrak"])
        ktr_row = df_ktr[df_ktr["kontrak_id"] == kid].iloc[0]
        tgl_mulai = ktr_row["tanggal_mulai"]

        # Uji transaksi ke-2 (ada riwayat)
        pos = 2
        trx_dict = sub_df.iloc[pos].to_dict()
        riwayat = [sub_df.iloc[i].to_dict() for i in range(pos)]

        f_single = hitung_fitur_satu_transaksi(
            trx_dict, riwayat, pagu, nilai_k, tanggal_mulai_kontrak=tgl_mulai
        )

        # Cari index baris di df_trx asli
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
    # c(256) bernilai sekitar 10.24477
    assert 10.2 < c_256 < 10.3


def test_latih_dan_tentukan_ambang(dataset):
    """
    DoD Fase 3:
    - Model dilatih pada split 'pengembangan', baris lolos aturan, tanpa label.
    - Ambang ditentukan dari split 'validasi'.
    - Laju false alarm validasi <= 2%.
    """
    df_trx, df_prj, df_ktr = dataset
    cfg = muat_konfigurasi_aturan()

    # Identifikasi baris melanggar aturan
    melanggar = evaluasi_aturan_dataframe(df_trx, df_prj, df_ktr, config=cfg)
    df_lolos = df_trx[~melanggar].copy().reset_index(drop=True)

    # Ekstraksi fitur untuk seluruh data lolos
    X_all = bangun_fitur_dataframe(df_lolos)

    # Filter split
    mask_dev = (df_lolos["split"] == "pengembangan").values
    mask_val = (df_lolos["split"] == "validasi").values

    X_train = X_all.values[mask_dev]
    X_val = X_all.values[mask_val]
    y_val = df_lolos.loc[mask_val, "label_anomali"].values

    assert X_train.shape[1] == 15
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
