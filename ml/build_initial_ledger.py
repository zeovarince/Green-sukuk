"""Bangun ledger transaksi dan peringatan awal untuk data simulasi seed 42."""

import json
import os
import time
import uuid

import pandas as pd

from gstp.aturan import (
    evaluasi_aturan_dataframe,
    muat_konfigurasi_aturan,
    periksa_aturan_transaksi,
)
from gstp.fitur import bangun_fitur_dataframe
from gstp.ledger import (
    kanonikalisasi_payload,
    hitung_hash_entri_ledger,
    verifikasi_rantai_ledger,
)
from gstp.model import (
    hitung_skor_iforest,
    latih_model_isolation_forest,
    tentukan_ambang_validasi,
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data_simulasi")
ARTIFACTS_DIR = os.path.join(BASE_DIR, "artifacts")


def bangun_peringatan_awal(df_trx, df_prj, df_ktr):
    """Ambil peringatan hybrid pada split pengujian dengan model seed 42."""
    model_path = os.path.join(ARTIFACTS_DIR, "model_if.json")
    with open(model_path, "r", encoding="utf-8") as f:
        model_meta = json.load(f)

    config = muat_konfigurasi_aturan()
    aturan_melanggar = evaluasi_aturan_dataframe(df_trx, df_prj, df_ktr, config=config).to_numpy()
    mask_dev = df_trx["split"].eq("pengembangan").to_numpy()
    df_dev_lolos = df_trx.loc[mask_dev & (~aturan_melanggar)]
    fitur_dev = bangun_fitur_dataframe(df_dev_lolos).values
    model = latih_model_isolation_forest(fitur_dev, seed=42)

    mask_val = df_trx["split"].eq("validasi").to_numpy()
    df_val = df_trx.loc[mask_val].copy().reset_index(drop=True)
    aturan_val = aturan_melanggar[mask_val]
    skor_val = hitung_skor_iforest(model, bangun_fitur_dataframe(df_val).values)
    baris_val_lolos = ~aturan_val
    ambang, _, _ = tentukan_ambang_validasi(
        skor_val[baris_val_lolos],
        df_val.loc[baris_val_lolos, "label_anomali"].to_numpy(),
        max_far=0.02,
    )

    mask_uji = df_trx["split"].eq("pengujian").to_numpy()
    df_uji = df_trx.loc[mask_uji].copy().reset_index(drop=True)
    aturan_uji = aturan_melanggar[mask_uji]
    skor_uji = hitung_skor_iforest(model, bangun_fitur_dataframe(df_uji).values)
    ditandai = aturan_uji | ((~aturan_uji) & (skor_uji >= ambang))
    proyek_sah = set(df_prj["project_id"].astype(str))
    peta_kontrak = df_ktr.set_index("kontrak_id")["project_id"].astype(str).to_dict()
    versi_model = model_meta["versi_model"]
    hasil = []

    for posisi in range(len(df_uji)):
        if not ditandai[posisi]:
            continue
        row = df_uji.iloc[posisi]
        detail_aturan = periksa_aturan_transaksi(
            row.to_dict(),
            proyek_sah,
            peta_kontrak,
            float(row["pagu_alokasi_kontrak"]),
            config=config,
        )
        kode_aturan = sorted(item["kode"] for item in detail_aturan["temuan"])
        jenis = "aturan" if kode_aturan else "skor"
        nilai_skor = None if kode_aturan else float(skor_uji[posisi])
        ambang_peringatan = None if kode_aturan else ambang
        trx_id = str(row["trx_id"])
        peringatan_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"gstp:seed-42:{trx_id}:{versi_model}"))
        dibuat_pada = f"{row['tanggal']}T00:00:00Z"

        hasil.append({
            "id": peringatan_id,
            "trx_id": trx_id,
            "jenis": jenis,
            "kode_aturan": json.dumps(kode_aturan, separators=(",", ":")),
            "skor": nilai_skor,
            "ambang": ambang_peringatan,
            "versi_model": versi_model,
            "status": "baru",
            "catatan": "Peringatan simulasi dari evaluasi seed 42.",
            "dibuat_pada": dibuat_pada,
            "diperbarui_pada": dibuat_pada,
        })

    return hasil


def main():
    print("=== Membangun Ledger Awal Simulasi ===")
    trx_csv = os.path.join(DATA_DIR, "transaksi_gstp.csv")
    prj_csv = os.path.join(DATA_DIR, "registri_proyek.csv")
    ktr_csv = os.path.join(DATA_DIR, "registri_kontrak.csv")
    for path in (trx_csv, prj_csv, ktr_csv):
        if not os.path.exists(path):
            raise FileNotFoundError(f"File {path} tidak ditemukan. Jalankan generator data lebih dulu.")

    t0 = time.time()
    df = pd.read_csv(trx_csv)
    # Urutan waktu dan kontrak harus sama dengan yang dipakai pembangun fitur.
    df = df.sort_values(["tanggal", "kontrak_id", "trx_id"], kind="mergesort").reset_index(drop=True)
    df_prj = pd.read_csv(prj_csv)
    df_ktr = pd.read_csv(ktr_csv)

    total_trx = len(df)
    print(f"Memproses {total_trx:,} transaksi ke ledger hash-chain...")

    baris_ledger = []
    hash_prev = "GENESIS"
    for i, row in df.iterrows():
        trx_id = str(row["trx_id"])
        payload = {
            "hash_tercatat": str(row["hash_tercatat"]),
            "jenis": "transaksi",
            "kontrak_id": str(row["kontrak_id"]),
            "nilai_pencairan": int(row["nilai_pencairan"]),
            "tanggal": str(row["tanggal"]),
            "trx_id": trx_id,
        }
        payload_kanonik = kanonikalisasi_payload(payload)
        hash_payload, hash_saat_ini = hitung_hash_entri_ledger(hash_prev, payload_kanonik)
        baris_ledger.append({
            "seq": len(baris_ledger) + 1,
            "jenis_entri": "transaksi",
            "trx_id": trx_id,
            "payload_kanonik": payload_kanonik,
            "payload": json.dumps(payload, separators=(",", ":"), ensure_ascii=False),
            "hash_payload": hash_payload,
            "hash_sebelumnya": hash_prev,
            "hash_saat_ini": hash_saat_ini,
            "dibuat_pada": f"{row['tanggal']}T00:00:00Z",
        })
        hash_prev = hash_saat_ini

    peringatan_awal = bangun_peringatan_awal(df, df_prj, df_ktr)
    print(f"Menambahkan {len(peringatan_awal):,} peringatan hybrid dari split pengujian seed 42...")
    for peringatan in peringatan_awal:
        payload = {
            "ambang": peringatan["ambang"],
            "jenis": peringatan["jenis"],
            "kode_aturan": json.loads(peringatan["kode_aturan"]),
            "peringatan_id": peringatan["id"],
            "skor": peringatan["skor"],
            "trx_id": peringatan["trx_id"],
            "versi_model": peringatan["versi_model"],
        }
        payload_kanonik = kanonikalisasi_payload(payload)
        hash_payload, hash_saat_ini = hitung_hash_entri_ledger(hash_prev, payload_kanonik)
        baris_ledger.append({
            "seq": len(baris_ledger) + 1,
            "jenis_entri": "peringatan",
            "trx_id": peringatan["trx_id"],
            "payload_kanonik": payload_kanonik,
            "payload": json.dumps(payload, separators=(",", ":"), ensure_ascii=False),
            "hash_payload": hash_payload,
            "hash_sebelumnya": hash_prev,
            "hash_saat_ini": hash_saat_ini,
            "dibuat_pada": peringatan["dibuat_pada"],
        })
        hash_prev = hash_saat_ini

    out_csv = os.path.join(DATA_DIR, "ledger_entri_awal.csv")
    pd.DataFrame(baris_ledger).to_csv(out_csv, index=False, encoding="utf-8")
    out_peringatan = os.path.join(DATA_DIR, "peringatan_awal.csv")
    pd.DataFrame(peringatan_awal).to_csv(out_peringatan, index=False, encoding="utf-8")

    print(f"Selesai dalam {time.time() - t0:.2f} detik.")
    print(f"Ledger: {out_csv} ({os.path.getsize(out_csv):,} bytes)")
    print(f"Peringatan: {out_peringatan} ({os.path.getsize(out_peringatan):,} bytes)")

    print("\nMemverifikasi seluruh rantai lokal...")
    hasil = verifikasi_rantai_ledger(baris_ledger)
    print(f"Hasil verifikasi: valid={hasil['valid']}, entri={hasil['entri_diperiksa']:,}.")
    assert hasil["valid"], f"Rantai ledger tidak valid pada seq {hasil.get('rusak_pada')}"


if __name__ == "__main__":
    main()
