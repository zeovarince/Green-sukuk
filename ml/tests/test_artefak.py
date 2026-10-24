"""
ml/tests/test_artefak.py
========================
Tes validasi format dan integritas berkas artefak di ml/artifacts/
sesuai docs/EXPORT_SPEC.md.
"""

import json
import os
import pytest

from gstp.fitur import DAFTAR_FITUR
from gstp.ledger import kanonikalisasi_payload, hitung_hash_entri_ledger

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARTIFACTS_DIR = os.path.join(BASE_DIR, "artifacts")


def test_berkas_artefak_lengkap():
    wajib = [
        "rules_config.json",
        "model_if.json",
        "golden_cases.json",
        "hasil_evaluasi.json",
    ]
    for b in wajib:
        path = os.path.join(ARTIFACTS_DIR, b)
        assert os.path.exists(path), f"Berkas artefak {b} tidak ditemukan!"
        assert os.path.getsize(path) > 0, f"Berkas artefak {b} kosong!"


def test_format_model_if():
    path = os.path.join(ARTIFACTS_DIR, "model_if.json")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert data["versi_skema"] == 1
    assert data["seed"] == 42
    assert data["fitur"] == DAFTAR_FITUR
    assert data["n_estimators"] == 200
    assert data["max_samples"] == 256
    assert "ambang" in data
    assert len(data["pohon"]) == 200

    # Cek struktur pohon pertama
    p0 = data["pohon"][0]
    assert "fitur" in p0
    assert "ambang" in p0
    assert "kiri" in p0
    assert "kanan" in p0
    assert "n_sampel" in p0
    assert len(p0["fitur"]) == len(p0["ambang"]) == len(p0["kiri"]) == len(p0["kanan"]) == len(p0["n_sampel"])

    # Ukuran file wajar untuk Vercel (< 2 MB)
    size_mb = os.path.getsize(path) / (1024 * 1024)
    assert size_mb < 2.0, f"Ukuran model_if.json terlalu besar: {size_mb:.2f} MB"


def test_format_golden_cases():
    path = os.path.join(ARTIFACTS_DIR, "golden_cases.json")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert data["versi_skema"] == 1
    assert "kasus" in data
    kasus = data["kasus"]
    assert len(kasus) >= 200

    # Pastikan seluruh subtipe tercakup dalam kasus
    subtipe_ditemukan = set(c["subtipe"] for c in kasus)
    assert "biasa" in subtipe_ditemukan
    assert "lonjakan_tanpa_progres" in subtipe_ditemukan
    assert "pemecahan_pencairan" in subtipe_ditemukan
    assert "progres_stagnan_tapi_cair" in subtipe_ditemukan
    assert "pencairan_setelah_selesai" in subtipe_ditemukan
    assert "bukti_wajib_hilang" in subtipe_ditemukan
    assert "hash_tidak_cocok" in subtipe_ditemukan
    assert "id_proyek_tidak_valid" in subtipe_ditemukan
    assert "kategori_tidak_memenuhi_syarat" in subtipe_ditemukan
    assert "melebihi_pagu" in subtipe_ditemukan
    assert "milestone_belum_terverifikasi" in subtipe_ditemukan
    assert "persetujuan_wajib_hilang" in subtipe_ditemukan

    # Cek struktur kasus emas
    c0 = kasus[0]
    assert "id" in c0
    assert "masukan" in c0
    assert "riwayat" in c0
    assert "jawaban" in c0
    assert "fitur" in c0["jawaban"]
    assert "aturan" in c0["jawaban"]
    assert "lolos_aturan" in c0["jawaban"]
    assert "skor" in c0["jawaban"]
    assert "keputusan" in c0["jawaban"]

    # Cek kasus ledger kanonik
    assert "ledger_kanonik_cases" in data
    for lc in data["ledger_kanonik_cases"]:
        p_kanonik = kanonikalisasi_payload(lc["payload"])
        assert p_kanonik == lc["payload_kanonik_expected"]
        h_payload, h_curr = hitung_hash_entri_ledger(lc["hash_sebelumnya"], p_kanonik)
        assert h_payload == lc["hash_payload_expected"]
        assert h_curr == lc["hash_saat_ini_expected"]
