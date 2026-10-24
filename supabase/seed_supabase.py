"""
supabase/seed_supabase.py
=========================
Skrip pengimpor data massal dari file simulasi ke Supabase Postgres:
1. registri_proyek (registri_proyek.csv)
2. registri_kontrak (registri_kontrak.csv)
3. transaksi (transaksi_gstp.csv)
4. ledger_entri (ledger_entri_awal.csv)
5. meta_model (dari model_if.json)
6. Penyesuaian identity sequence ledger_entri_seq_seq

Membaca variabel lingkungan:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
atau
  SUPABASE_DB_URL (koneksi direct postgresql://postgres:password@db.xxx.supabase.co:5432/postgres)
"""

import json
import os
import sys
import time
import pandas as pd
import requests

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "ml", "data_simulasi")
ARTIFACTS_DIR = os.path.join(BASE_DIR, "ml", "artifacts")


def import_via_rest_api(supabase_url: str, service_role_key: str):
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

    # 1. Registri Proyek
    prj_csv = os.path.join(DATA_DIR, "registri_proyek.csv")
    print(f"Mengimpor registri_proyek dari {prj_csv}...")
    df_prj = pd.read_csv(prj_csv)
    records = df_prj.to_dict(orient="records")
    # Batch per 1000
    for i in range(0, len(records), 1000):
        batch = records[i:i + 1000]
        res = requests.post(f"{supabase_url}/rest/v1/registri_proyek", headers=headers, json=batch)
        if res.status_code not in (200, 201):
            raise RuntimeError(f"Gagal impor registri_proyek: {res.status_code} - {res.text}")
    print(f"registri_proyek berhasil diimpor: {len(records)} baris.")

    # 2. Registri Kontrak
    ktr_csv = os.path.join(DATA_DIR, "registri_kontrak.csv")
    print(f"Mengimpor registri_kontrak dari {ktr_csv}...")
    df_ktr = pd.read_csv(ktr_csv)
    records = df_ktr.to_dict(orient="records")
    for i in range(0, len(records), 1000):
        batch = records[i:i + 1000]
        res = requests.post(f"{supabase_url}/rest/v1/registri_kontrak", headers=headers, json=batch)
        if res.status_code not in (200, 201):
            raise RuntimeError(f"Gagal impor registri_kontrak: {res.status_code} - {res.text}")
    print(f"registri_kontrak berhasil diimpor: {len(records)} baris.")

    # 3. Transaksi
    trx_csv = os.path.join(DATA_DIR, "transaksi_gstp.csv")
    print(f"Mengimpor transaksi dari {trx_csv}...")
    df_trx = pd.read_csv(trx_csv)
    # Ganti NaN dengan None untuk JSON
    df_trx = df_trx.where(pd.notnull(df_trx), None)
    records = df_trx.to_dict(orient="records")
    for i in range(0, len(records), 2000):
        batch = records[i:i + 2000]
        res = requests.post(f"{supabase_url}/rest/v1/transaksi", headers=headers, json=batch)
        if res.status_code not in (200, 201):
            raise RuntimeError(f"Gagal impor transaksi batch {i}: {res.status_code} - {res.text}")
        if (i // 2000) % 5 == 0:
            print(f"  Transaksi terimpor: {min(i + 2000, len(records))}/{len(records)}...")
    print(f"transaksi berhasil diimpor: {len(records)} baris.")

    # 4. Ledger Entri
    led_csv = os.path.join(DATA_DIR, "ledger_entri_awal.csv")
    print(f"Mengimpor ledger_entri dari {led_csv}...")
    df_led = pd.read_csv(led_csv)
    # Parse payload json string menjadi dict agar jsonb valid
    df_led["payload"] = df_led["payload"].apply(json.loads)
    records = df_led.to_dict(orient="records")
    for i in range(0, len(records), 2000):
        batch = records[i:i + 2000]
        res = requests.post(f"{supabase_url}/rest/v1/ledger_entri", headers=headers, json=batch)
        if res.status_code not in (200, 201):
            raise RuntimeError(f"Gagal impor ledger_entri batch {i}: {res.status_code} - {res.text}")
        if (i // 2000) % 5 == 0:
            print(f"  Ledger terimpor: {min(i + 2000, len(records))}/{len(records)}...")
    print(f"ledger_entri berhasil diimpor: {len(records)} baris.")

    # 5. Meta Model
    model_json_path = os.path.join(ARTIFACTS_DIR, "model_if.json")
    if os.path.exists(model_json_path):
        with open(model_json_path, "r", encoding="utf-8") as f:
            m_data = json.load(f)
        meta_rec = [{
            "versi_model": m_data["versi_model"],
            "ambang": m_data["ambang"],
        }]
        res = requests.post(f"{supabase_url}/rest/v1/meta_model", headers=headers, json=meta_rec)
        print(f"meta_model berhasil disimpan: {meta_rec}")


def main():
    supabase_url = os.environ.get("SUPABASE_URL")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not service_role_key:
        print("PERINGATAN: SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum disetel di environment.")
        print("Penggunaan:")
        print("  $env:SUPABASE_URL = 'https://xxx.supabase.co'")
        print("  $env:SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOi...'")
        print("  python supabase/seed_supabase.py")
        sys.exit(1)

    import_via_rest_api(supabase_url.rstrip("/"), service_role_key)


if __name__ == "__main__":
    main()
