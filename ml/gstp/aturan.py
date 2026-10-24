"""
ml/gstp/aturan.py
=================
Implementasi 7 aturan deterministik GSTP sesuai docs/RULES.md.
"""

from __future__ import annotations
import json
import os
from typing import Any, Dict, List, Optional, Set, Tuple


def muat_konfigurasi_aturan(path_config: Optional[str] = None) -> Dict[str, Any]:
    """Memuat parameter aturan dari rules_config.json."""
    if path_config is None:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        path_config = os.path.join(base_dir, "artifacts", "rules_config.json")
    with open(path_config, "r", encoding="utf-8") as f:
        return json.load(f)


def hitung_persetujuan_wajib(
    nilai_pencairan: float | int,
    config: Optional[Dict[str, Any]] = None
) -> int:
    """
    Menghitung jumlah persetujuan minimal yang diwajibkan:
    - Di bawah ambang dua_mulai: 1 persetujuan
    - Di bawah ambang tiga_mulai: 2 persetujuan
    - Mulai ambang tiga_mulai ke atas: 3 persetujuan
    """
    if config is None:
        config = muat_konfigurasi_aturan()
    ambang = config.get("ambang_persetujuan_rupiah", {"dua_mulai": 1_000_000_000, "tiga_mulai": 5_000_000_000})
    dua_mulai = ambang.get("dua_mulai", 1_000_000_000)
    tiga_mulai = ambang.get("tiga_mulai", 5_000_000_000)

    if nilai_pencairan < dua_mulai:
        return 1
    elif nilai_pencairan < tiga_mulai:
        return 2
    else:
        return 3


def periksa_aturan_transaksi(
    transaksi: Dict[str, Any],
    proyek_sah: Set[str],
    peta_kontrak_ke_proyek: Dict[str, str],
    pagu_alokasi_kontrak: float | int,
    kumulatif_cair_sebelumnya: float | int = 0,
    config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Memeriksa satu transaksi terhadap 7 aturan deterministik.

    Parameter:
      transaksi: dict transaksi saat ini
      proyek_sah: himpunan project_id yang sah
      peta_kontrak_ke_proyek: pemetaan kontrak_id -> project_id sah
      pagu_alokasi_kontrak: pagu alokasi untuk kontrak ini
      kumulatif_cair_sebelumnya: total kumulatif cair sebelum transaksi ini
      config: dict konfigurasi aturan

    Mengembalikan:
      {
        "lolos": bool,
        "temuan": [{"kode": str, "pesan": str}]
      }
    """
    if config is None:
        config = muat_konfigurasi_aturan()

    kategori_sah = set(config.get("kategori_sah", []))
    ambang_bukti = float(config.get("ambang_bukti", 0.80))

    temuan: List[Dict[str, str]] = []

    project_id = str(transaksi.get("project_id", ""))
    kontrak_id = str(transaksi.get("kontrak_id", ""))
    nilai_pencairan = float(transaksi.get("nilai_pencairan", 0))

    # R01_ID_PROYEK: project_id tidak ada di registri_proyek, atau tidak sama dengan proyek milik kontrak_id
    expected_project_id = peta_kontrak_ke_proyek.get(kontrak_id)
    if (project_id not in proyek_sah) or (expected_project_id is not None and project_id != expected_project_id):
        temuan.append({
            "kode": "R01_ID_PROYEK",
            "pesan": f"ID proyek {project_id} tidak valid atau tidak sesuai dengan registri kontrak."
        })

    # R02_PAGU: kumulatif_cair (termasuk transaksi ini) lebih besar dari pagu_alokasi_kontrak
    kumulatif_total = kumulatif_cair_sebelumnya + nilai_pencairan
    # Jika transaksi sudah memiliki kumulatif_cair eksplisit yang valid (misalnya dari batch), gunakan jika kumulatif_cair_sebelumnya 0
    if "kumulatif_cair" in transaksi and kumulatif_cair_sebelumnya == 0:
        kumulatif_total = float(transaksi["kumulatif_cair"])

    if kumulatif_total > float(pagu_alokasi_kontrak):
        temuan.append({
            "kode": "R02_PAGU",
            "pesan": f"Kumulatif pencairan Rp{kumulatif_total:,.0f} melebihi pagu alokasi kontrak Rp{pagu_alokasi_kontrak:,.0f}."
        })

    # R03_PERSETUJUAN: persetujuan_diperoleh lebih kecil dari persetujuan_wajib
    persetujuan_wajib = transaksi.get("persetujuan_wajib")
    if persetujuan_wajib is None:
        persetujuan_wajib = hitung_persetujuan_wajib(nilai_pencairan, config)
    else:
        persetujuan_wajib = int(persetujuan_wajib)

    persetujuan_diperoleh = int(transaksi.get("persetujuan_diperoleh", 0))
    if persetujuan_diperoleh < persetujuan_wajib:
        temuan.append({
            "kode": "R03_PERSETUJUAN",
            "pesan": f"Persetujuan yang diperoleh {persetujuan_diperoleh}, yang diwajibkan {persetujuan_wajib}."
        })

    # R04_KATEGORI: kategori_hijau tidak ada di daftar kategori sah
    kategori_hijau = transaksi.get("kategori_hijau", "")
    if kategori_hijau not in kategori_sah:
        temuan.append({
            "kode": "R04_KATEGORI",
            "pesan": f"Kategori '{kategori_hijau}' tidak termasuk dalam kategori hijau yang memenuhi syarat."
        })

    # R05_HASH: hash_tercatat berbeda dari hash_dokumen_saat_ini
    hash_tercatat = str(transaksi.get("hash_tercatat", ""))
    hash_saat_ini = str(transaksi.get("hash_dokumen_saat_ini", ""))
    if hash_tercatat != hash_saat_ini:
        temuan.append({
            "kode": "R05_HASH",
            "pesan": "Hash dokumen saat ini tidak cocok dengan hash yang tercatat."
        })

    # R06_MILESTONE: milestone_terverifikasi salah dan jenis_pembayaran adalah termin
    milestone_terverifikasi = bool(transaksi.get("milestone_terverifikasi", True))
    jenis_pembayaran = str(transaksi.get("jenis_pembayaran", "")).lower()
    if not milestone_terverifikasi and jenis_pembayaran == "termin":
        temuan.append({
            "kode": "R06_MILESTONE",
            "pesan": "Pembayaran termin diajukan namun verifikasi milestone belum terpenuhi."
        })

    # R07_BUKTI: kelengkapan_bukti lebih kecil dari ambang bukti (0,80)
    kelengkapan_bukti = float(transaksi.get("kelengkapan_bukti", 0.0))
    # toleransi float presisi
    if round(kelengkapan_bukti, 4) < round(ambang_bukti, 4):
        temuan.append({
            "kode": "R07_BUKTI",
            "pesan": f"Kelengkapan bukti ({kelengkapan_bukti:.2f}) di bawah ambang batas minimal ({ambang_bukti:.2f})."
        })

    return {
        "lolos": len(temuan) == 0,
        "temuan": temuan
    }


def evaluasi_aturan_dataframe(df, reg_proyek, reg_kontrak, config: Optional[Dict[str, Any]] = None):
    """
    Evaluasi vektor untuk seluruh DataFrame transaksi simulasi.
    Mengembalikan Series boolean: True jika melanggar minimal satu aturan (ditandai peringatan aturan).
    """
    if config is None:
        config = muat_konfigurasi_aturan()

    proyek_sah = set(reg_proyek["project_id"])
    peta_kontrak = reg_kontrak.set_index("kontrak_id")["project_id"]
    kategori_sah = set(config["kategori_sah"])
    ambang_bukti = float(config.get("ambang_bukti", 0.80))

    r1 = ~df["project_id"].isin(proyek_sah) | (
        df["project_id"] != df["kontrak_id"].map(peta_kontrak)
    )
    r2 = df["kumulatif_cair"] > df["pagu_alokasi_kontrak"]
    r3 = df["persetujuan_diperoleh"] < df["persetujuan_wajib"]
    r4 = ~df["kategori_hijau"].isin(kategori_sah)
    r5 = df["hash_tercatat"] != df["hash_dokumen_saat_ini"]
    r6 = (~df["milestone_terverifikasi"].astype(bool)) & (df["jenis_pembayaran"] == "termin")
    r7 = df["kelengkapan_bukti"] < ambang_bukti

    return r1 | r2 | r3 | r4 | r5 | r6 | r7
