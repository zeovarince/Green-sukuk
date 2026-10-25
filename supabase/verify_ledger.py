"""Verifikasi penuh hash-chain ledger Supabase melalui Data REST API."""

import os
import sys

import requests

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE_DIR, "ml"))

from gstp.ledger import verifikasi_rantai_ledger  # noqa: E402


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


def ambil_konfigurasi():
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
    return supabase_url.rstrip("/"), secret_key


def muat_entri_ledger(session, supabase_url: str, ukuran_halaman: int = 1000):
    entri = []
    offset = 0
    while True:
        res = session.get(
            f"{supabase_url}/rest/v1/ledger_entri",
            params={
                "select": "seq,payload_kanonik,hash_payload,hash_sebelumnya,hash_saat_ini",
                "order": "seq.asc",
                "limit": ukuran_halaman,
                "offset": offset,
            },
            timeout=60,
        )
        if res.status_code != 200:
            raise RuntimeError(f"Gagal membaca ledger: HTTP {res.status_code}.")
        batch = res.json()
        if not isinstance(batch, list):
            raise RuntimeError("Respons ledger Supabase bukan daftar entri.")
        entri.extend(batch)
        print(f"Terbaca {len(entri):,} entri...", end="\r", flush=True)
        if len(batch) < ukuran_halaman:
            break
        offset += len(batch)
    print()
    return entri


def main():
    supabase_url, secret_key = ambil_konfigurasi()
    session = requests.Session()
    # Supabase secret keys bukan JWT; kirim hanya melalui header `apikey`.
    session.headers.update({
        "apikey": secret_key,
        "User-Agent": "gstp-ledger-verifier/1.0",
    })

    entri = muat_entri_ledger(session, supabase_url)
    hasil = verifikasi_rantai_ledger(entri)
    if hasil["valid"]:
        print(f"Ledger valid: {hasil['entri_diperiksa']:,} entri diperiksa.")
        if entri:
            print(f"Rentang seq: {entri[0]['seq']} to {entri[-1]['seq']}.")
        else:
            print("Ledger kosong.")
        print(f"Hash terakhir: {hasil['hash_terakhir']}.")
        return

    print(f"Ledger tidak valid pada seq {hasil['rusak_pada']}: {hasil['alasan']}")
    sys.exit(1)


if __name__ == "__main__":
    main()
