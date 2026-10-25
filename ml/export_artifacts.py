"""
ml/export_artifacts.py
======================
Ekspor artefak model, aturan, dan kasus emas (golden cases) untuk aplikasi web
sesuai docs/EXPORT_SPEC.md.

Artefak yang dihasilkan di ml/artifacts/:
1. rules_config.json: parameter 7 aturan
2. model_if.json: struktur pohon Isolation Forest, urutan fitur, ambang
3. golden_cases.json: kasus uji lengkap (semua subtipe + normal) untuk verifikasi kesesuaian TypeScript
"""

import json
import os
import numpy as np
import pandas as pd
import sklearn
from datetime import datetime

from gstp.aturan import (
    muat_konfigurasi_aturan,
    periksa_aturan_transaksi,
    evaluasi_aturan_dataframe,
)
from gstp.fitur import (
    DAFTAR_FITUR,
    bangun_fitur_dataframe,
    hitung_fitur_satu_transaksi,
)
from gstp.model import (
    c_factor,
    latih_model_isolation_forest,
    hitung_skor_iforest,
    tentukan_ambang_validasi,
)
from gstp.ledger import kanonikalisasi_payload, hitung_hash_entri_ledger

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ARTIFACTS_DIR = os.path.join(BASE_DIR, "artifacts")
DATA_DIR = os.path.join(BASE_DIR, "data_simulasi")


def ekspor_model_if(model, ambang: float, out_path: str):
    """
    Mengekspor pohon Isolation Forest ke format JSON sesuai docs/EXPORT_SPEC.md bagian 2.
    """
    c_max = float(c_factor(256))
    pohon_list = []

    for est in model.estimators_:
        t = est.tree_
        pohon_list.append({
            "fitur": [int(f) for f in t.feature],
            "ambang": [round(float(th), 17) for th in t.threshold],
            "kiri": [int(k) for k in t.children_left],
            "kanan": [int(k) for k in t.children_right],
            "n_sampel": [int(n) for n in t.n_node_samples],
        })

    data_model = {
        "versi_skema": 1,
        "dibuat_pada": datetime.now().strftime("%Y-%m-%d"),
        "versi_model": "if-2026-10-a",
        "seed": 42,
        "versi_sklearn": sklearn.__version__,
        "fitur": DAFTAR_FITUR,
        "n_estimators": len(model.estimators_),
        "max_samples": 256,
        "c_max_samples": round(c_max, 17),
        "ambang": round(float(ambang), 4),
        "pohon": pohon_list,
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data_model, f, separators=(",", ":"), ensure_ascii=False)
    print(f"Model tersimpan di: {out_path} ({os.path.getsize(out_path):,} bytes)")


def bangun_golden_cases(df_trx, df_prj, df_ktr, model, ambang: float, cfg, out_path: str):
    """
    Membangun minimal 20 kasus per subtipe + kasus normal + kasus pinggiran
    sesuai docs/EXPORT_SPEC.md bagian 3.
    """
    proyek_sah = set(df_prj["project_id"])
    peta_kontrak = df_ktr.set_index("kontrak_id")["project_id"].to_dict()
    peta_pagu = df_ktr.set_index("kontrak_id")["pagu_alokasi"].to_dict()
    peta_nilai_k = df_ktr.set_index("kontrak_id")["nilai_kontrak_awal"].to_dict()
    peta_mulai = df_ktr.set_index("kontrak_id")["tanggal_mulai"].to_dict()

    # Urutkan seluruh transaksi per tanggal & kontrak
    df_sorted = df_trx.sort_values(["tanggal", "kontrak_id"], kind="mergesort").reset_index(drop=True)

    rng = np.random.default_rng(42)
    kasus_list = []
    case_counter = 1

    # Ambil sedikitnya 20 per subtipe anomali, dan 200 normal biasa
    subtypes = df_sorted["subtipe_kasus"].unique()

    idx_terpilih = []
    for st in subtypes:
        mask = df_sorted["subtipe_kasus"] == st
        n_avail = mask.sum()
        target_n = 200 if st == "biasa" else 20
        n_ambil = min(n_avail, target_n)
        sub_indices = df_sorted[mask].index.values
        idx_terpilih.extend(rng.choice(sub_indices, size=n_ambil, replace=False))

    idx_terpilih = sorted(set(idx_terpilih))

    # Bangun dictionary riwayat per kontrak
    grup_kontrak = df_sorted.groupby("kontrak_id")

    for idx in idx_terpilih:
        row = df_sorted.iloc[idx]
        kid = row["kontrak_id"]
        tgl_curr = row["tanggal"]
        pagu = float(row["pagu_alokasi_kontrak"])
        nilai_k = float(row["nilai_kontrak"])
        tgl_mulai = peta_mulai.get(kid, str(tgl_curr))

        # Riwayat adalah transaksi pada kontrak ini SEBELUM transaksi ini
        # Ambil subset kontrak sebelum indeks baris ini
        k_indices = grup_kontrak.groups[kid]
        pos_in_k = list(k_indices).index(idx)
        prev_indices = list(k_indices)[:pos_in_k]

        riwayat = []
        for p_idx in prev_indices:
            p_row = df_sorted.iloc[p_idx]
            riwayat.append({
                "tanggal": str(p_row["tanggal"]),
                "nilai_pencairan": int(p_row["nilai_pencairan"]),
                "progres_fisik_pct": float(p_row["progres_fisik_pct"]),
            })

        masukan = {
            "project_id": str(row["project_id"]),
            "kontrak_id": str(kid),
            "tanggal": str(row["tanggal"]),
            "jenis_pembayaran": str(row["jenis_pembayaran"]),
            "nilai_pencairan": int(row["nilai_pencairan"]),
            "progres_fisik_pct": float(row["progres_fisik_pct"]),
            "milestone_terverifikasi": bool(row["milestone_terverifikasi"]),
            "persetujuan_diperoleh": int(row["persetujuan_diperoleh"]),
            "persetujuan_wajib": int(row["persetujuan_wajib"]),
            "kelengkapan_bukti": float(row["kelengkapan_bukti"]),
            "kategori_hijau": str(row["kategori_hijau"]),
            "hash_tercatat": str(row["hash_tercatat"]),
            "hash_dokumen_saat_ini": str(row["hash_dokumen_saat_ini"]),
            "bulan_ke": int(row["bulan_ke"]),
        }

        # Jawaban Python:
        # 1. Fitur
        fitur_dict = hitung_fitur_satu_transaksi(
            masukan, riwayat, pagu, nilai_k, tanggal_mulai_kontrak=tgl_mulai
        )

        # 2. Aturan
        kum_prev = sum(r["nilai_pencairan"] for r in riwayat)
        hasil_aturan = periksa_aturan_transaksi(
            masukan,
            proyek_sah,
            peta_kontrak,
            pagu,
            kumulatif_cair_sebelumnya=kum_prev,
            config=cfg,
        )
        aturan_terpicu = [t["kode"] for t in hasil_aturan["temuan"]]
        lolos_aturan = hasil_aturan["lolos"]

        # 3. Skor model
        vec_feat = np.array([[fitur_dict[f] for f in DAFTAR_FITUR]])
        skor_raw = float(hitung_skor_iforest(model, vec_feat)[0])

        # Keputusan
        if not lolos_aturan:
            keputusan = "peringatan_aturan"
        elif skor_raw >= ambang:
            keputusan = "peringatan_skor"
        else:
            keputusan = "wajar"

        kasus_list.append({
            "id": f"g-{case_counter:04d}",
            "subtipe": str(row["subtipe_kasus"]),
            "kontrak_id": str(kid),
            "masukan": masukan,
            "riwayat": riwayat,
            "konteks": {
                "project_id_kontrak": str(peta_kontrak.get(kid, "")),
                "project_id_sah": str(row["project_id"]) in proyek_sah,
                "pagu_alokasi_kontrak": int(pagu),
                "nilai_kontrak": int(nilai_k),
                "tanggal_mulai_kontrak": str(tgl_mulai),
                "kumulatif_cair_sebelumnya": int(kum_prev),
            },
            "jawaban": {
                "fitur": {k: float(v) for k, v in fitur_dict.items()},
                "aturan": sorted(aturan_terpicu),
                "lolos_aturan": lolos_aturan,
                "skor": skor_raw,
                "ambang": float(ambang),
                "keputusan": keputusan,
            },
        })
        case_counter += 1

    # Kasus uji kanonikalisasi dan hash ledger (LEDGER_SPEC.md bagian 4 & EXPORT_SPEC.md bagian 6)
    ledger_cases = []
    test_payloads = [
        {"trx_id": "TRX-000001", "kontrak_id": "PRJ-0001-K01", "nilai_pencairan": 1000000000, "status": "wajar"},
        {"peringatan_id": "WRN-000001", "trx_id": "TRX-000002", "kode_aturan": ["R02_PAGU"], "skor": 0.68},
    ]
    hash_prev = "GENESIS"
    for lp in test_payloads:
        p_kanonik = kanonikalisasi_payload(lp)
        h_payload, h_curr = hitung_hash_entri_ledger(hash_prev, p_kanonik)
        ledger_cases.append({
            "payload": lp,
            "hash_sebelumnya": hash_prev,
            "payload_kanonik_expected": p_kanonik,
            "hash_payload_expected": h_payload,
            "hash_saat_ini_expected": h_curr,
        })
        hash_prev = h_curr

    golden_data = {
        "versi_skema": 1,
        "dibuat_pada": datetime.now().strftime("%Y-%m-%d"),
        "jumlah_kasus": len(kasus_list),
        "kasus": kasus_list,
        "ledger_kanonik_cases": ledger_cases,
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(golden_data, f, ensure_ascii=False, indent=2)
    print(f"Golden cases tersimpan di: {out_path} ({len(kasus_list)} kasus, {os.path.getsize(out_path):,} bytes)")


def main():
    print("=== Mengekspor Artefak Model dan Kasus Emas (Fase 5) ===")
    os.makedirs(ARTIFACTS_DIR, exist_ok=True)

    cfg = muat_konfigurasi_aturan()

    # Muat data simulasi
    df_trx = pd.read_csv(os.path.join(DATA_DIR, "transaksi_gstp.csv"))
    df_prj = pd.read_csv(os.path.join(DATA_DIR, "registri_proyek.csv"))
    df_ktr = pd.read_csv(os.path.join(DATA_DIR, "registri_kontrak.csv"))

    # Latih model pada split pengembangan lolos aturan
    melanggar = evaluasi_aturan_dataframe(df_trx, df_prj, df_ktr, config=cfg)
    df_dev_lolos = df_trx[(df_trx["split"] == "pengembangan") & (~melanggar)]
    X_dev = bangun_fitur_dataframe(df_dev_lolos).values

    print("1. Melatih Isolation Forest (seed 42)...")
    model = latih_model_isolation_forest(X_dev, seed=42)

    # Muat ambang dari hasil_evaluasi.json jika ada, atau hitung
    eval_json_path = os.path.join(ARTIFACTS_DIR, "hasil_evaluasi.json")
    if os.path.exists(eval_json_path):
        with open(eval_json_path, "r", encoding="utf-8") as f:
            eval_data = json.load(f)
        ambang = float(eval_data["ambang"]["nilai"])
    else:
        df_val = df_trx[df_trx["split"] == "validasi"]
        mel_val = melanggar[df_trx["split"] == "validasi"].values
        X_val = bangun_fitur_dataframe(df_val).values
        skor_val = hitung_skor_iforest(model, X_val)
        y_val = df_val["label_anomali"].values
        ambang, _, _ = tentukan_ambang_validasi(skor_val[~mel_val], y_val[~mel_val], max_far=0.02)

    print(f"2. Ambang model yang digunakan: {ambang}")

    # 1. rules_config.json sudah ada, pastikan valid
    rules_cfg_path = os.path.join(ARTIFACTS_DIR, "rules_config.json")
    cfg_export = dict(cfg)
    cfg_export["versi_skema"] = 1
    cfg_export["dibuat_pada"] = datetime.now().strftime("%Y-%m-%d")
    with open(rules_cfg_path, "w", encoding="utf-8") as f:
        json.dump(cfg_export, f, ensure_ascii=False, indent=2)

    # 2. model_if.json
    model_out_path = os.path.join(ARTIFACTS_DIR, "model_if.json")
    ekspor_model_if(model, ambang, model_out_path)

    # 3. golden_cases.json
    golden_out_path = os.path.join(ARTIFACTS_DIR, "golden_cases.json")
    bangun_golden_cases(df_trx, df_prj, df_ktr, model, ambang, cfg, golden_out_path)

    print("\nEkspor artefak selesai dengan sukses.")


if __name__ == "__main__":
    main()
