"""
ml/gstp/ledger.py
=================
Fungsi hash-chain dan kanonikalisasi payload ledger GSTP sesuai docs/LEDGER_SPEC.md.
"""

from __future__ import annotations
import hashlib
import json
from typing import Any, Dict, List, Optional, Tuple


def kanonikalisasi_payload(payload: Dict[str, Any]) -> str:
    """
    Menghasilkan string JSON kanonik:
    - Kunci diurutkan secara alfabetis (sort_keys=True)
    - Tanpa spasi ekstra (separators=(',', ':'))
    - Format UTF-8
    """
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def hitung_hash_sha256(teks: str) -> str:
    """Menghitung heksadesimal SHA-256 huruf kecil sepanjang 64 karakter."""
    return hashlib.sha256(teks.encode("utf-8")).hexdigest()


def hitung_hash_entri_ledger(hash_sebelumnya: str, payload_kanonik: str) -> Tuple[str, str]:
    """
    Rumus hash ledger (docs/LEDGER_SPEC.md bagian 4):
    hash_payload  = SHA-256( payload_kanonik )
    hash_saat_ini = SHA-256( hash_sebelumnya + "|" + hash_payload )
    """
    hash_payload = hitung_hash_sha256(payload_kanonik)
    gabungan = f"{hash_sebelumnya}|{hash_payload}"
    hash_saat_ini = hitung_hash_sha256(gabungan)
    return hash_payload, hash_saat_ini


def verifikasi_rantai_ledger(entri_list: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Memverifikasi integritas rantai ledger:
    1. Urutkan entri menurut seq
    2. hash_sebelumnya entri pertama harus 'GENESIS'
    3. hash_payload cocok dengan SHA-256(payload_kanonik)
    4. hash_saat_ini cocok dengan SHA-256(hash_sebelumnya + '|' + hash_payload)
    """
    entri_urut = sorted(entri_list, key=lambda x: int(x["seq"]))
    hash_prev_expected = "GENESIS"

    for entri in entri_urut:
        seq = int(entri["seq"])
        payload_kanonik = str(entri["payload_kanonik"])
        stored_hash_payload = str(entri["hash_payload"])
        stored_hash_sebelumnya = str(entri["hash_sebelumnya"])
        stored_hash_saat_ini = str(entri["hash_saat_ini"])

        # Cek hash_sebelumnya
        if stored_hash_sebelumnya != hash_prev_expected:
            return {
                "valid": False,
                "entri_diperiksa": seq - 1,
                "rusak_pada": seq,
                "alasan": f"hash_sebelumnya tidak cocok pada seq {seq}",
                "hash_terakhir": hash_prev_expected,
            }

        # Cek hash payload
        calc_hash_payload, calc_hash_saat_ini = hitung_hash_entri_ledger(
            stored_hash_sebelumnya, payload_kanonik
        )

        if calc_hash_payload != stored_hash_payload:
            return {
                "valid": False,
                "entri_diperiksa": seq - 1,
                "rusak_pada": seq,
                "alasan": f"hash_payload tidak cocok pada seq {seq}",
                "hash_terakhir": hash_prev_expected,
            }

        if calc_hash_saat_ini != stored_hash_saat_ini:
            return {
                "valid": False,
                "entri_diperiksa": seq - 1,
                "rusak_pada": seq,
                "alasan": f"hash_saat_ini tidak cocok pada seq {seq}",
                "hash_terakhir": hash_prev_expected,
            }

        hash_prev_expected = stored_hash_saat_ini

    return {
        "valid": True,
        "entri_diperiksa": len(entri_urut),
        "rusak_pada": None,
        "hash_terakhir": hash_prev_expected,
    }
