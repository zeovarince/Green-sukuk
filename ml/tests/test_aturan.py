"""
ml/tests/test_aturan.py
=======================
Tes kepatuhan rule engine terhadap 7 aturan deterministik dan data simulasi.
"""

import os
import pandas as pd
import pytest
from gstp.aturan import (
    muat_konfigurasi_aturan,
    hitung_persetujuan_wajib,
    periksa_aturan_transaksi,
    evaluasi_aturan_dataframe,
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data_simulasi")


@pytest.fixture(scope="module")
def dataset():
    trx_path = os.path.join(DATA_DIR, "transaksi_gstp.csv")
    prj_path = os.path.join(DATA_DIR, "registri_proyek.csv")
    ktr_path = os.path.join(DATA_DIR, "registri_kontrak.csv")

    assert os.path.exists(trx_path), f"File {trx_path} belum ada. Jalankan generator data dulu."
    df_trx = pd.read_csv(trx_path)
    df_prj = pd.read_csv(prj_path)
    df_ktr = pd.read_csv(ktr_path)
    return df_trx, df_prj, df_ktr


def test_konfigurasi_aturan():
    cfg = muat_konfigurasi_aturan()
    assert cfg["versi"] == 1
    assert "kategori_sah" in cfg
    assert len(cfg["kategori_sah"]) == 8
    assert cfg["ambang_bukti"] == 0.80


def test_hitung_persetujuan_wajib():
    cfg = muat_konfigurasi_aturan()
    assert hitung_persetujuan_wajib(500_000_000, cfg) == 1
    assert hitung_persetujuan_wajib(999_999_999, cfg) == 1
    assert hitung_persetujuan_wajib(1_000_000_000, cfg) == 2
    assert hitung_persetujuan_wajib(4_999_999_999, cfg) == 2
    assert hitung_persetujuan_wajib(5_000_000_000, cfg) == 3
    assert hitung_persetujuan_wajib(10_000_000_000, cfg) == 3


def test_aturan_satuan_tiap_kode():
    """Memastikan setiap aturan (R01 sampai R07) memiliki minimal 1 kasus lolos dan 1 kasus melanggar."""
    cfg = muat_konfigurasi_aturan()
    proyek_sah = {"PRJ-0001"}
    peta_kontrak = {"PRJ-0001-K01": "PRJ-0001"}
    pagu = 10_000_000_000

    base_trx = {
        "project_id": "PRJ-0001",
        "kontrak_id": "PRJ-0001-K01",
        "nilai_pencairan": 2_000_000_000,
        "kategori_hijau": "Transportasi berkelanjutan",
        "persetujuan_wajib": 2,
        "persetujuan_diperoleh": 2,
        "hash_tercatat": "hash123",
        "hash_dokumen_saat_ini": "hash123",
        "milestone_terverifikasi": True,
        "jenis_pembayaran": "termin",
        "kelengkapan_bukti": 0.95,
    }

    # Kasus dasar: lolos semua
    res_lolos = periksa_aturan_transaksi(base_trx, proyek_sah, peta_kontrak, pagu, kumulatif_cair_sebelumnya=1_000_000_000, config=cfg)
    assert res_lolos["lolos"] is True
    assert len(res_lolos["temuan"]) == 0

    # R01: Project ID tidak valid
    trx_r01 = dict(base_trx, project_id="PRJ-9999")
    res_r01 = periksa_aturan_transaksi(trx_r01, proyek_sah, peta_kontrak, pagu, kumulatif_cair_sebelumnya=0, config=cfg)
    assert res_r01["lolos"] is False
    assert any(t["kode"] == "R01_ID_PROYEK" for t in res_r01["temuan"])

    # R02: Melebihi pagu
    res_r02 = periksa_aturan_transaksi(base_trx, proyek_sah, peta_kontrak, pagu, kumulatif_cair_sebelumnya=9_500_000_000, config=cfg)
    assert res_r02["lolos"] is False
    assert any(t["kode"] == "R02_PAGU" for t in res_r02["temuan"])

    # R03: Persetujuan kurang
    trx_r03 = dict(base_trx, persetujuan_diperoleh=1, persetujuan_wajib=2)
    res_r03 = periksa_aturan_transaksi(trx_r03, proyek_sah, peta_kontrak, pagu, kumulatif_cair_sebelumnya=0, config=cfg)
    assert res_r03["lolos"] is False
    assert any(t["kode"] == "R03_PERSETUJUAN" for t in res_r03["temuan"])

    # R04: Kategori tidak memenuhi syarat
    trx_r04 = dict(base_trx, kategori_hijau="Pembangunan PLTU Batubara")
    res_r04 = periksa_aturan_transaksi(trx_r04, proyek_sah, peta_kontrak, pagu, kumulatif_cair_sebelumnya=0, config=cfg)
    assert res_r04["lolos"] is False
    assert any(t["kode"] == "R04_KATEGORI" for t in res_r04["temuan"])

    # R05: Hash tidak cocok
    trx_r05 = dict(base_trx, hash_dokumen_saat_ini="hash_palsu")
    res_r05 = periksa_aturan_transaksi(trx_r05, proyek_sah, peta_kontrak, pagu, kumulatif_cair_sebelumnya=0, config=cfg)
    assert res_r05["lolos"] is False
    assert any(t["kode"] == "R05_HASH" for t in res_r05["temuan"])

    # R06: Milestone belum terverifikasi (termin)
    trx_r06 = dict(base_trx, milestone_terverifikasi=False, jenis_pembayaran="termin")
    res_r06 = periksa_aturan_transaksi(trx_r06, proyek_sah, peta_kontrak, pagu, kumulatif_cair_sebelumnya=0, config=cfg)
    assert res_r06["lolos"] is False
    assert any(t["kode"] == "R06_MILESTONE" for t in res_r06["temuan"])

    # Catatan untuk R06: jika bukan termin (misalnya uang_muka), tidak melanggar R06
    trx_r06_um = dict(base_trx, milestone_terverifikasi=False, jenis_pembayaran="uang_muka")
    res_r06_um = periksa_aturan_transaksi(trx_r06_um, proyek_sah, peta_kontrak, pagu, kumulatif_cair_sebelumnya=0, config=cfg)
    assert not any(t["kode"] == "R06_MILESTONE" for t in res_r06_um["temuan"])

    # R07: Bukti tidak lengkap
    trx_r07 = dict(base_trx, kelengkapan_bukti=0.79)
    res_r07 = periksa_aturan_transaksi(trx_r07, proyek_sah, peta_kontrak, pagu, kumulatif_cair_sebelumnya=0, config=cfg)
    assert res_r07["lolos"] is False
    assert any(t["kode"] == "R07_BUKTI" for t in res_r07["temuan"])


def test_evaluasi_pada_data_simulasi(dataset):
    """
    DoD Fase 2:
    - Aturan menangkap seluruh baris anomali_aturan (894/894).
    - Tidak menandai satu pun baris normal dan normal_tidak_lazim_sah (0 baris).
    - Anomali kontekstual yang tertangkap: 0.
    """
    df_trx, df_prj, df_ktr = dataset
    cfg = muat_konfigurasi_aturan()

    ditandai = evaluasi_aturan_dataframe(df_trx, df_prj, df_ktr, config=cfg)
    kel = df_trx["kelompok_kasus"]

    normal_ditandai = ditandai[kel.isin(["normal", "normal_tidak_lazim_sah"])].sum()
    anomali_aturan_tertangkap = ditandai[kel == "anomali_aturan"].sum()
    anomali_aturan_total = (kel == "anomali_aturan").sum()
    anomali_kontekstual_tertangkap = ditandai[kel == "anomali_kontekstual"].sum()

    assert normal_ditandai == 0, f"Normal ditandai aturan harus 0, didapat {normal_ditandai}"
    assert anomali_aturan_tertangkap == anomali_aturan_total, (
        f"Semua anomali aturan harus tertangkap ({anomali_aturan_total}), "
        f"hanya tertangkap {anomali_aturan_tertangkap}"
    )
    assert anomali_kontekstual_tertangkap == 0, (
        f"Anomali kontekstual tidak boleh ditandai aturan, didapat {anomali_kontekstual_tertangkap}"
    )
