"""
ml/build_initial_ledger.py
==========================
Membangun catatan ledger awal berurutan untuk seluruh transaksi simulasi
sesuai docs/DATABASE_SPEC.md bagian 5 dan docs/LEDGER_SPEC.md.

Keluaran:
  ml/data_simulasi/ledger_entri_awal.csv
"""

import json
import os
import time
import pandas as pd
from datetime import datetime

from gstp.ledger import (
    kanonikalisasi_payload,
    hitung_hash_entri_ledger,
    verifikasi_rantai_ledger,
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data_simulasi")


def main():
    print("=== Membangun Ledger Awal Simulasi ===")
    trx_csv = os.path.join(DATA_DIR, "transaksi_gstp.csv")
    if not os.path.exists(trx_csv):
        raise FileNotFoundError(f"File {trx_csv} tidak ditemukan. Jalankan generate_gstp_data.py lebih dulu.")

    t0 = time.time()
    df = pd.read_csv(trx_csv)
    # Urutkan berdasarkan tanggal dan trx_id
    df = df.sort_values(["tanggal", "trx_id"], kind="mergesort").reset_index(drop=True)

    total_trx = len(df)
    print(f"Memproses {total_trx:,} transaksi ke ledger hash-chain...")

    baris_ledger = []
    hash_prev = "GENESIS"

    for i, row in df.iterrows():
        trx_id = str(row["trx_id"])
        kontrak_id = str(row["kontrak_id"])
        tanggal = str(row["tanggal"])
        nilai_pencairan = int(row["nilai_pencairan"])
        hash_tercatat = str(row["hash_tercatat"])

        # Payload kanonik untuk jenis_entri 'transaksi' (sesuai LEDGER_SPEC.md bagian 3)
        payload = {
            "hash_tercatat": hash_tercatat,
            "jenis": "transaksi",
            "kontrak_id": kontrak_id,
            "nilai_pencairan": nilai_pencairan,
            "tanggal": tanggal,
            "trx_id": trx_id,
        }

        payload_kanonik = kanonikalisasi_payload(payload)
        hash_payload, hash_saat_ini = hitung_hash_entri_ledger(hash_prev, payload_kanonik)

        baris_ledger.append({
            "seq": i + 1,
            "jenis_entri": "transaksi",
            "trx_id": trx_id,
            "payload_kanonik": payload_kanonik,
            "payload": json.dumps(payload, separators=(",", ":"), ensure_ascii=False),
            "hash_payload": hash_payload,
            "hash_sebelumnya": hash_prev,
            "hash_saat_ini": hash_saat_ini,
            "dibuat_pada": f"{tanggal}T00:00:00Z",
        })

        hash_prev = hash_saat_ini

    df_ledger = pd.DataFrame(baris_ledger)
    out_csv = os.path.join(DATA_DIR, "ledger_entri_awal.csv")
    df_ledger.to_csv(out_csv, index=False, encoding="utf-8")

    durasi = time.time() - t0
    print(f"Selesai dalam {durasi:.2f} detik.")
    print(f"Berkas tersimpan di: {out_csv} ({os.path.getsize(out_csv):,} bytes)")

    # Lakukan verifikasi penuh pada rantai yang baru dibuat
    print("\nMelakukan verifikasi penuh integritas rantai ledger...")
    cek = verifikasi_rantai_ledger(baris_ledger)
    print(f"Hasil verifikasi rantai: {cek}")
    assert cek["valid"] is True, f"Rantai ledger tidak valid! Rusak pada seq: {cek.get('rusak_pada')}"
    print("Verifikasi rantai sukses: Seluruh hash mengunci dengan benar dari GENESIS.")


if __name__ == "__main__":
    main()
