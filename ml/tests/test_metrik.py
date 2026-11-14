"""
ml/tests/test_metrik.py
=======================
Tes metrik tambahan fase R3 pada data kecil buatan dengan jawaban yang diketahui.
"""

import os

import numpy as np
import pandas as pd
import pytest

from gstp.ledger import (
    hitung_hash_entri_ledger,
    kanonikalisasi_payload,
    verifikasi_rantai_ledger,
)
from gstp.metrik import (
    deteksi_pola_beruntun,
    hitung_biaya,
    kelengkapan_tautan,
    uji_perusakan,
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARTIFACTS_DIR = os.path.join(BASE_DIR, "artifacts")


def _data_pola() -> pd.DataFrame:
    # Kontrak A: pola 2 baris, lalu 1 normal, lalu pola 3 baris.
    # Kontrak B: hanya normal. trx_id sengaja tidak berurutan di DataFrame.
    baris = [
        ("TRX-000006", "A", 1, "progres_stagnan_tapi_cair"),
        ("TRX-000001", "A", 1, "pemecahan_pencairan"),
        ("TRX-000003", "A", 0, "biasa"),
        ("TRX-000004", "A", 1, "progres_stagnan_tapi_cair"),
        ("TRX-000002", "A", 1, "pemecahan_pencairan"),
        ("TRX-000005", "A", 1, "progres_stagnan_tapi_cair"),
        ("TRX-000010", "B", 0, "biasa"),
        ("TRX-000009", "B", 1, "hash_tidak_cocok"),
    ]
    return pd.DataFrame(baris, columns=["trx_id", "kontrak_id", "label_anomali", "subtipe_kasus"])


def test_deteksi_pola_beruntun_menghitung_posisi_pertama():
    df = _data_pola()
    # Urutan dalam kontrak A menurut trx_id: 001, 002, 003, 004, 005, 006
    # Pola 1: 001-002. Pola 2: 004-005-006.
    prediksi = {
        "aturan_saja": [1, 1, 0, 0, 0, 0, 0, 0],  # TRX-006 dan TRX-001 ditandai
        "iforest_saja": [0, 0, 0, 0, 0, 1, 0, 0],
        "hybrid": [0, 0, 0, 0, 0, 0, 0, 0],
    }
    hasil = deteksi_pola_beruntun(df, prediksi)

    assert hasil["jumlah_pola"] == 2
    assert [r["panjang"] for r in hasil["rincian"]] == [2, 3]
    # Aturan menandai TRX-001 (posisi 1 pola 1) dan TRX-006 (posisi 3 pola 2).
    assert hasil["aturan_saja"] == {"terdeteksi_pct": 100.0, "median_posisi": 2.0}
    # Isolation Forest hanya menandai TRX-005, posisi kedua pada pola 2.
    assert hasil["iforest_saja"] == {"terdeteksi_pct": 50.0, "median_posisi": 2.0}
    assert hasil["hybrid"] == {"terdeteksi_pct": 0.0, "median_posisi": None}


def test_deteksi_pola_beruntun_mengabaikan_subtipe_lain():
    df = _data_pola()
    nol = np.zeros(len(df), dtype=int)
    hasil = deteksi_pola_beruntun(df, {"aturan_saja": nol})
    assert hasil["jumlah_pola"] == 2
    assert hasil["aturan_saja"]["terdeteksi_pct"] == 0.0
    # hash_tidak_cocok pada kontrak B bukan pola beruntun.
    assert all(r["kontrak_id"] == "A" for r in hasil["rincian"])


def test_deteksi_pola_beruntun_menolak_prediksi_salah_panjang():
    df = _data_pola()
    with pytest.raises(ValueError):
        deteksi_pola_beruntun(df, {"aturan_saja": [0, 0, 1]})


def _registri():
    proyek = pd.DataFrame({"project_id": ["PRJ-1", "PRJ-2"]})
    kontrak = pd.DataFrame({
        "kontrak_id": ["PRJ-1-K01", "PRJ-2-K01"],
        "project_id": ["PRJ-1", "PRJ-2"],
    })
    return proyek, kontrak


def test_kelengkapan_tautan_menghitung_tiap_syarat():
    df = pd.DataFrame([
        # Lengkap.
        {"trx_id": "t1", "project_id": "PRJ-1", "kontrak_id": "PRJ-1-K01", "hash_tercatat": "a", "hash_dokumen_saat_ini": "a"},
        # Proyek tidak valid; kontrak tidak cocok dengan proyek.
        {"trx_id": "t2", "project_id": "PRJ-X", "kontrak_id": "PRJ-1-K01", "hash_tercatat": "a", "hash_dokumen_saat_ini": "a"},
        # Hash tidak cocok.
        {"trx_id": "t3", "project_id": "PRJ-2", "kontrak_id": "PRJ-2-K01", "hash_tercatat": "a", "hash_dokumen_saat_ini": "b"},
        # Tidak ada entri ledger.
        {"trx_id": "t4", "project_id": "PRJ-1", "kontrak_id": "PRJ-1-K01", "hash_tercatat": "a", "hash_dokumen_saat_ini": "a"},
    ])
    proyek, kontrak = _registri()

    hasil = kelengkapan_tautan(df, proyek, kontrak, {"t1", "t2", "t3"})

    assert hasil["n"] == 4
    assert hasil["proyek_valid"] == 0.75
    assert hasil["kontrak_milik_proyek"] == 0.75
    assert hasil["hash_cocok"] == 0.75
    assert hasil["entri_ledger"] == 0.75
    assert hasil["gabungan"] == 0.25
    assert hasil["seluruh_data"]["gabungan"] == 0.25


def test_kelengkapan_tautan_memakai_split_pengujian_untuk_kunci_datar():
    df = pd.DataFrame([
        {"trx_id": "t1", "project_id": "PRJ-1", "kontrak_id": "PRJ-1-K01", "hash_tercatat": "a", "hash_dokumen_saat_ini": "a", "split": "pengujian"},
        {"trx_id": "t2", "project_id": "PRJ-1", "kontrak_id": "PRJ-1-K01", "hash_tercatat": "a", "hash_dokumen_saat_ini": "a", "split": "pengembangan"},
    ])
    proyek, kontrak = _registri()
    hasil = kelengkapan_tautan(df, proyek, kontrak, {"t1"})
    assert hasil["n"] == 1
    assert hasil["gabungan"] == 1.0
    assert hasil["seluruh_data"]["n"] == 2
    assert hasil["seluruh_data"]["gabungan"] == 0.5


def test_hitung_biaya_membaca_ukuran_berkas(tmp_path):
    model = tmp_path / "model_if.json"
    ledger = tmp_path / "ledger.csv"
    transaksi = tmp_path / "transaksi.csv"
    model.write_bytes(b"x" * 2048)
    ledger.write_bytes(b"y" * 4096)
    transaksi.write_bytes(b"z" * 1024)

    hasil = hitung_biaya(
        model_path=str(model),
        ledger_path=str(ledger),
        transaksi_path=str(transaksi),
        jumlah_baris_transaksi=10,
        jumlah_baris_ledger=20,
        waktu_latih_detik=1.23456,
        waktu_inferensi_ms=0.0312,
        waktu_verifikasi_penuh_detik=0.5,
    )

    assert hasil["ukuran_model_kb"] == 2.0
    assert hasil["ukuran_ledger_csv_kb"] == 4.0
    assert hasil["ukuran_transaksi_csv_kb"] == 1.0
    assert hasil["baris_transaksi"] == 10
    assert hasil["baris_ledger"] == 20
    assert hasil["waktu_latih_detik"] == 1.235
    assert hasil["waktu_inferensi_ms"] == 0.031
    assert hasil["waktu_verifikasi_penuh_detik"] == 0.5


def _rantai(jumlah: int):
    entri = []
    sebelumnya = "GENESIS"
    for i in range(1, jumlah + 1):
        payload = kanonikalisasi_payload({"jenis": "transaksi", "trx_id": f"TRX-{i:06d}"})
        hash_payload, hash_saat_ini = hitung_hash_entri_ledger(sebelumnya, payload)
        entri.append({
            "seq": i,
            "jenis_entri": "transaksi",
            "payload_kanonik": payload,
            "hash_payload": hash_payload,
            "hash_sebelumnya": sebelumnya,
            "hash_saat_ini": hash_saat_ini,
        })
        sebelumnya = hash_saat_ini
    return entri


def test_rantai_buatan_valid():
    assert verifikasi_rantai_ledger(_rantai(20))["valid"] is True


def test_pemotongan_ekor_tidak_terdeteksi_tanpa_jangkar():
    # Batas yang tercatat: verifikasi rantai tidak memeriksa jumlah/ujung rantai.
    assert verifikasi_rantai_ledger(_rantai(20)[:-1])["valid"] is True


def test_uji_perusakan_membedakan_hash_chain_dan_tabel_log():
    hasil = uji_perusakan(_rantai(100), percobaan=50, seed=42)

    assert hasil["jumlah_entri"] == 100
    assert hasil["percobaan_per_skenario"] == 50
    for nama in ("ubah", "hapus", "sisip", "tukar"):
        assert hasil[nama]["hash_chain"]["terdeteksi_pct"] == 100.0
        assert hasil[nama]["hash_chain"]["lokasi_tepat_pct"] == 100.0
        assert hasil[nama]["tabel_log"] == {"terdeteksi_pct": 0.0, "lokasi_tepat_pct": 0.0}

    # Hitung ulang seluruh rantai tidak terdeteksi oleh keduanya.
    assert hasil["hitung_ulang"]["hash_chain"] == {"terdeteksi_pct": 0.0, "lokasi_tepat_pct": 0.0}
    assert hasil["hitung_ulang"]["tabel_log"] == {"terdeteksi_pct": 0.0, "lokasi_tepat_pct": 0.0}


def test_uji_perusakan_menolak_rantai_rusak():
    entri = _rantai(10)
    entri[3]["payload_kanonik"] = "{\"dirusak\":true}"
    with pytest.raises(ValueError):
        uji_perusakan(entri, percobaan=5)


def test_hasil_evaluasi_memuat_kunci_metrik_tambahan():
    import json

    path = os.path.join(ARTIFACTS_DIR, "hasil_evaluasi.json")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert set(data["waktu_deteksi_pola"]) >= {"jumlah_pola", "aturan_saja", "iforest_saja", "hybrid"}
    assert set(data["kelengkapan_tautan"]) >= {
        "n", "proyek_valid", "kontrak_milik_proyek", "hash_cocok", "entri_ledger", "gabungan", "seluruh_data",
    }
    assert set(data["biaya"]) >= {
        "ukuran_model_kb", "waktu_latih_detik", "waktu_inferensi_ms", "waktu_verifikasi_penuh_detik",
    }
    for nama in ("ubah", "hapus", "sisip", "tukar", "hitung_ulang"):
        assert set(data["uji_perusakan"][nama]) == {"hash_chain", "tabel_log"}
        assert set(data["uji_perusakan"][nama]["hash_chain"]) == {"terdeteksi_pct", "lokasi_tepat_pct"}
