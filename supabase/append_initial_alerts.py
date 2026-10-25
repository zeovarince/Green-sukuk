"""Tambahkan peringatan awal seed 42 ke database yang sudah memuat transaksi."""

import csv
import json
import os

import requests

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "ml", "data_simulasi")


def parse_env_file():
    env_path = os.path.join(BASE_DIR, ".env")
    env_vars = {}
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8-sig") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    value = value.strip()
                    if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
                        value = value[1:-1]
                    env_vars[key.strip()] = value
    return env_vars


def load_csv(path):
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def create_session(secret_key):
    session = requests.Session()
    session.headers.update({
        "apikey": secret_key,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
        "User-Agent": "gstp-seed-alerts/1.0",
    })
    return session


def get_count(session, supabase_url, table):
    response = session.get(
        f"{supabase_url}/rest/v1/{table}?select=*&limit=1",
        headers={"Prefer": "count=exact"},
        timeout=30,
    )
    if response.status_code not in (200, 206):
        raise RuntimeError(f"Gagal membaca tabel {table}: HTTP {response.status_code}.")
    content_range = response.headers.get("Content-Range", "")
    try:
        return int(content_range.rsplit("/", 1)[1])
    except (IndexError, ValueError):
        raise RuntimeError(f"Jumlah baris tabel {table} tidak dapat dibaca.")


def get_ledger_tail(session, supabase_url):
    response = session.get(
        f"{supabase_url}/rest/v1/ledger_entri",
        params={"select": "seq,hash_saat_ini", "order": "seq.desc", "limit": 1},
        timeout=30,
    )
    if response.status_code not in (200, 206):
        raise RuntimeError(f"Gagal membaca entri ledger terakhir: HTTP {response.status_code}.")
    rows = response.json()
    return rows[0] if rows else None


def validate_existing_alerts(session, supabase_url, warnings):
    response = session.get(
        f"{supabase_url}/rest/v1/peringatan",
        params={"select": "id", "limit": 1000},
        timeout=30,
    )
    if response.status_code not in (200, 206):
        raise RuntimeError(f"Gagal memeriksa ID peringatan: HTTP {response.status_code}.")
    existing = {str(row["id"]) for row in response.json()}
    expected = {row["id"] for row in warnings}
    if existing != expected:
        raise RuntimeError("Isi tabel peringatan tidak sama dengan peringatan seed 42 yang diharapkan.")


def main():
    env_file = parse_env_file()
    supabase_url = os.environ.get("SUPABASE_URL") or env_file.get("SUPABASE_URL")
    secret_key = (
        os.environ.get("SUPABASE_SECRET_KEY")
        or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or env_file.get("SUPABASE_SECRET_KEY")
        or env_file.get("SUPABASE_SERVICE_ROLE_KEY")
    )
    if not supabase_url or not secret_key:
        raise RuntimeError("SUPABASE_URL dan SUPABASE_SECRET_KEY harus tersedia di environment atau .env.")
    supabase_url = supabase_url.rstrip("/")

    warning_path = os.path.join(DATA_DIR, "peringatan_awal.csv")
    ledger_path = os.path.join(DATA_DIR, "ledger_entri_awal.csv")
    if not os.path.exists(warning_path) or not os.path.exists(ledger_path):
        raise FileNotFoundError("Jalankan `python ml/build_initial_ledger.py` lebih dulu.")

    warnings = load_csv(warning_path)
    for row in warnings:
        row["kode_aturan"] = json.loads(row["kode_aturan"])
        for field in ("skor", "ambang"):
            row[field] = float(row[field]) if row[field] else None
    ledger_rows = load_csv(ledger_path)
    transaction_rows = [row for row in ledger_rows if row["jenis_entri"] == "transaksi"]
    warning_ledger_rows = [row for row in ledger_rows if row["jenis_entri"] == "peringatan"]
    if len(warnings) != len(warning_ledger_rows):
        raise RuntimeError("Jumlah peringatan dan entri ledger lokal tidak cocok.")

    session = create_session(secret_key)
    transaction_count = get_count(session, supabase_url, "transaksi")
    ledger_count = get_count(session, supabase_url, "ledger_entri")
    warning_count = get_count(session, supabase_url, "peringatan")
    if transaction_count != len(transaction_rows):
        raise RuntimeError(
            f"Jumlah transaksi Supabase ({transaction_count:,}) tidak sama dengan CSV ({len(transaction_rows):,})."
        )
    if ledger_count < len(transaction_rows) or ledger_count > len(ledger_rows):
        raise RuntimeError("Jumlah entri ledger tidak cocok dengan posisi awal seed.")
    if warning_count not in (0, len(warnings)):
        raise RuntimeError("Tabel peringatan terisi sebagian; periksa database sebelum melanjutkan.")

    offset = ledger_count - len(transaction_rows)
    tail = get_ledger_tail(session, supabase_url)
    expected_tail = ledger_rows[ledger_count - 1]["hash_saat_ini"]
    if not tail or tail["hash_saat_ini"] != expected_tail:
        raise RuntimeError("Hash ledger terakhir Supabase tidak cocok dengan rantai awal lokal.")

    if warning_count == 0:
        for i in range(0, len(warnings), 1000):
            response = session.post(
                f"{supabase_url}/rest/v1/peringatan",
                json=warnings[i:i + 1000],
                timeout=60,
            )
            if response.status_code not in (200, 201, 204):
                raise RuntimeError(f"Gagal menyimpan peringatan: HTTP {response.status_code}.")
        print(f"Peringatan simulasi ditambahkan: {len(warnings):,}.")
    else:
        validate_existing_alerts(session, supabase_url, warnings)
        print("Peringatan seed 42 sudah ada; melanjutkan pemeriksaan ledger.")

    for i, row in enumerate(warning_ledger_rows[offset:], start=offset + 1):
        response = session.post(
            f"{supabase_url}/rest/v1/rpc/tambah_ledger",
            json={
                "p_jenis": row["jenis_entri"],
                "p_trx_id": row["trx_id"] or None,
                "p_payload_kanonik": row["payload_kanonik"],
                "p_payload": json.loads(row["payload"]),
                "p_hash_payload": row["hash_payload"],
            },
            headers={"Prefer": "return=representation"},
            timeout=60,
        )
        if response.status_code not in (200, 201):
            raise RuntimeError(f"Gagal menambahkan entri peringatan ke ledger: HTTP {response.status_code}.")
        result = response.json()
        if isinstance(result, list):
            result = result[0] if result else None
        expected = ledger_rows[len(transaction_rows) + i - 1]
        if not result or result.get("hash_saat_ini") != expected["hash_saat_ini"]:
            raise RuntimeError(f"Hash hasil tambah_ledger tidak cocok pada peringatan ke-{i}.")
        if i % 50 == 0 or i == len(warning_ledger_rows):
            print(f"Entri peringatan di ledger: {i:,}/{len(warning_ledger_rows):,}.")

    print("Selesai. Jalankan `python supabase/verify_ledger.py` untuk verifikasi penuh.")


if __name__ == "__main__":
    main()
