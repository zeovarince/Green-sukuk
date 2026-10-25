"""
supabase/seed_supabase.py
=========================
Skrip pengimpor data massal dari file simulasi ke Supabase Postgres:
1. registri_proyek (registri_proyek.csv)
2. registri_kontrak (registri_kontrak.csv)
3. transaksi (transaksi_gstp.csv)
4. ledger_entri (ledger_entri_awal.csv)
5. meta_model (dari model_if.json)
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


def parse_env_file():
    env_path = os.path.join(BASE_DIR, ".env")
    env_vars = {}
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8-sig") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    value = v.strip()
                    if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
                        value = value[1:-1]
                    env_vars[k.strip()] = value
    return env_vars


def buat_session(secret_key: str):
    session = requests.Session()
    # Secret keys Supabase bukan JWT; kirim hanya melalui header `apikey`.
    session.headers.update({
        "apikey": secret_key,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
        "User-Agent": "gstp-seed/1.0",
    })
    return session


def pastikan_database_kosong(session, supabase_url: str):
    tabel = ["registri_proyek", "registri_kontrak", "transaksi", "peringatan", "ledger_entri", "meta_model"]
    berisi = []
    for nama in tabel:
        res = session.get(
            f"{supabase_url}/rest/v1/{nama}?select=*&limit=1",
            headers={"Prefer": "count=exact"},
            timeout=30,
        )
        if res.status_code != 200:
            raise RuntimeError(f"Gagal memeriksa tabel {nama}: {res.status_code} - {res.text}")
        rentang = res.headers.get("Content-Range", "")
        try:
            jumlah = int(rentang.rsplit("/", 1)[1])
        except (IndexError, ValueError):
            raise RuntimeError(f"Jumlah baris tabel {nama} tidak dapat dibaca.")
        if jumlah:
            berisi.append(f"{nama} ({jumlah:,})")
    if berisi:
        raise RuntimeError(
            "Seed dibatalkan agar tidak menggandakan data. Tabel berikut sudah berisi: "
            + ", ".join(berisi)
        )


def import_via_rest_api(supabase_url: str, secret_key: str):
    session = buat_session(secret_key)
    pastikan_database_kosong(session, supabase_url)

    t0 = time.time()

    # 1. Registri Proyek
    prj_csv = os.path.join(DATA_DIR, "registri_proyek.csv")
    print(f"\n1/6 Mengimpor registri_proyek dari {prj_csv}...")
    df_prj = pd.read_csv(prj_csv)
    records = df_prj.to_dict(orient="records")
    for i in range(0, len(records), 1000):
        batch = records[i:i + 1000]
        res = session.post(f"{supabase_url}/rest/v1/registri_proyek", json=batch, timeout=60)
        if res.status_code not in (200, 201):
            raise RuntimeError(f"Gagal impor registri_proyek: {res.status_code} - {res.text}")
    print(f"registri_proyek berhasil diimpor: {len(records):,} baris.")

    # 2. Registri Kontrak
    ktr_csv = os.path.join(DATA_DIR, "registri_kontrak.csv")
    print(f"\n2/6 Mengimpor registri_kontrak dari {ktr_csv}...")
    df_ktr = pd.read_csv(ktr_csv)
    records = df_ktr.to_dict(orient="records")
    for i in range(0, len(records), 1000):
        batch = records[i:i + 1000]
        res = session.post(f"{supabase_url}/rest/v1/registri_kontrak", json=batch, timeout=60)
        if res.status_code not in (200, 201):
            raise RuntimeError(f"Gagal impor registri_kontrak: {res.status_code} - {res.text}")
    print(f"registri_kontrak berhasil diimpor: {len(records):,} baris.")

    # 3. Transaksi
    trx_csv = os.path.join(DATA_DIR, "transaksi_gstp.csv")
    print(f"\n3/6 Mengimpor transaksi dari {trx_csv}...")
    df_trx = pd.read_csv(trx_csv)
    df_trx = df_trx.astype(object).where(pd.notnull(df_trx), None)
    records = df_trx.to_dict(orient="records")
    batch_size = 1000
    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        res = session.post(f"{supabase_url}/rest/v1/transaksi", json=batch, timeout=60)
        if res.status_code not in (200, 201):
            raise RuntimeError(f"Gagal impor transaksi batch {i}: {res.status_code} - {res.text}")
        if (i // batch_size) % 10 == 0 or (i + batch_size >= len(records)):
            print(f"  Transaksi terimpor: {min(i + batch_size, len(records)):,}/{len(records):,}...")
    print(f"transaksi berhasil diimpor: {len(records):,} baris.")

    # 4. Peringatan simulasi seed 42
    warn_csv = os.path.join(DATA_DIR, "peringatan_awal.csv")
    print(f"\n4/6 Mengimpor peringatan dari {warn_csv}...")
    df_warn = pd.read_csv(warn_csv)
    df_warn = df_warn.astype(object).where(pd.notnull(df_warn), None)
    df_warn["kode_aturan"] = df_warn["kode_aturan"].apply(json.loads)
    records_warn = df_warn.to_dict(orient="records")
    for i in range(0, len(records_warn), 1000):
        batch = records_warn[i:i + 1000]
        res = session.post(f"{supabase_url}/rest/v1/peringatan", json=batch, timeout=60)
        if res.status_code not in (200, 201):
            raise RuntimeError(f"Gagal impor peringatan batch {i}: {res.status_code} - {res.text}")
    print(f"peringatan berhasil diimpor: {len(records_warn):,} baris.")

    # 5. Ledger Entri
    led_csv = os.path.join(DATA_DIR, "ledger_entri_awal.csv")
    print(f"\n5/6 Mengimpor ledger_entri dari {led_csv}...")
    df_led = pd.read_csv(led_csv)
    # Urutkan berdasarkan seq agar urutan identity sama persis 1, 2, 3 ...
    df_led = df_led.sort_values("seq", kind="mergesort").reset_index(drop=True)
    # Hapus kolom seq dari payload insert agar identity sequence mengisinya secara auto-increment berurutan
    kolom_ledger = ["jenis_entri", "trx_id", "payload_kanonik", "payload", "hash_payload", "hash_sebelumnya", "hash_saat_ini", "dibuat_pada"]
    df_led_insert = df_led[kolom_ledger].copy()
    df_led_insert["payload"] = df_led_insert["payload"].apply(json.loads)
    records_led = df_led_insert.to_dict(orient="records")

    batch_size_led = 1000
    for i in range(0, len(records_led), batch_size_led):
        batch = records_led[i:i + batch_size_led]
        res = session.post(f"{supabase_url}/rest/v1/ledger_entri", json=batch, timeout=60)
        if res.status_code not in (200, 201):
            raise RuntimeError(f"Gagal impor ledger_entri batch {i}: {res.status_code} - {res.text}")
        if (i // batch_size_led) % 10 == 0 or (i + batch_size_led >= len(records_led)):
            print(f"  Ledger terimpor: {min(i + batch_size_led, len(records_led)):,}/{len(records_led):,}...")
    print(f"ledger_entri berhasil diimpor: {len(records_led):,} baris.")

    # 6. Meta Model
    print(f"\n6/6 Mengimpor meta_model...")
    model_json_path = os.path.join(ARTIFACTS_DIR, "model_if.json")
    if not os.path.exists(model_json_path):
        raise FileNotFoundError(f"Artefak model tidak ditemukan: {model_json_path}")
    with open(model_json_path, "r", encoding="utf-8") as f:
        m_data = json.load(f)
    meta_rec = [{
        "versi_model": m_data["versi_model"],
        "ambang": m_data["ambang"],
    }]
    res = session.post(f"{supabase_url}/rest/v1/meta_model", json=meta_rec, timeout=60)
    if res.status_code not in (200, 201):
        raise RuntimeError(f"Gagal impor meta_model: {res.status_code} - {res.text}")
    print(f"meta_model berhasil disimpan: {len(meta_rec)} baris.")

    total_waktu = time.time() - t0
    print(f"\n=== Seluruh data berhasil diimpor dalam {total_waktu:.2f} detik ===")


def main():
    env_file = parse_env_file()
    supabase_url = os.environ.get("SUPABASE_URL") or env_file.get("SUPABASE_URL")
    secret_key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_SECRET_KEY")
        or env_file.get("SUPABASE_SERVICE_ROLE_KEY")
        or env_file.get("SUPABASE_SECRET_KEY")
    )

    if not supabase_url or not secret_key:
        print("ERROR: Kredensial Supabase tidak ditemukan!")
        sys.exit(1)

    import_via_rest_api(supabase_url.rstrip("/"), secret_key)


if __name__ == "__main__":
    main()
