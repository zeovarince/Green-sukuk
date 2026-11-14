"""
ml/export_artifacts.py
======================
Ekspor artefak model, aturan, dan kasus emas (golden cases) untuk aplikasi web
sesuai docs/EXPORT_SPEC.md (versi skema 2).

Artefak yang dihasilkan di ml/artifacts/ (dan disalin ke web/data/artifacts/):
1. rules_config.json: parameter 8 aturan (skema v2)
2. model_if.json: struktur pohon Isolation Forest, 18 fitur, tabel referensi kelompok, ambang (skema v2)
3. golden_cases.json: kasus uji lengkap untuk verifikasi kesesuaian TypeScript (skema v2)
"""

import json
import os
import shutil
from datetime import datetime
import numpy as np
import pandas as pd
import sklearn

from gstp.aturan import (
    PETA_PRINSIP,
    muat_konfigurasi_aturan,
    periksa_aturan_transaksi,
    evaluasi_aturan_dataframe,
)
from gstp.fitur import (
    DAFTAR_FITUR,
    bangun_fitur_dataframe,
    hitung_fitur_satu_transaksi,
    hitung_referensi_kelompok,
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
WEB_ARTIFACTS_DIR = os.path.join(os.path.dirname(BASE_DIR), "web", "data", "artifacts")


def ekspor_model_if(model, ambang: float, referensi_kelompok: dict, out_path: str):
    """
    Mengekspor pohon Isolation Forest ke format JSON sesuai docs/EXPORT_SPEC.md bagian 2 (skema versi 2).
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
        "versi_skema": 2,
        "dibuat_pada": datetime.now().strftime("%Y-%m-%d"),
        "versi_model": "if-2026-11-a",
        "seed": 42,
        "versi_sklearn": sklearn.__version__,
        "fitur": DAFTAR_FITUR,
        "referensi_kelompok": referensi_kelompok,
        "n_estimators": len(model.estimators_),
        "max_samples": 256,
        "c_max_samples": round(c_max, 17),
        "ambang": round(float(ambang), 4),
        "pohon": pohon_list,
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data_model, f, separators=(",", ":"), ensure_ascii=False)
    print(f"Model tersimpan di: {out_path} ({os.path.getsize(out_path):,} bytes)")


def bangun_golden_cases(df_trx, df_prj, df_ktr, model, ambang: float, referensi_kelompok: dict, cfg, out_path: str):
    """
    Membangun minimal 20 kasus per subtipe + kasus normal + kasus pinggiran
    sesuai docs/EXPORT_SPEC.md bagian 3 (skema versi 2).
    """
    proyek_sah = set(df_prj["project_id"])
    peta_kontrak = df_ktr.set_index("kontrak_id")["project_id"].to_dict()
    peta_pagu = df_ktr.set_index("kontrak_id")["pagu_alokasi"].to_dict()
    peta_nilai_k = df_ktr.set_index("kontrak_id")["nilai_kontrak_awal"].to_dict()
    peta_mulai = df_ktr.set_index("kontrak_id")["tanggal_mulai"].to_dict()
    peta_durasi = df_ktr.set_index("kontrak_id")["durasi_bulan"].to_dict()
    peta_akad = df_prj.set_index("project_id")["akad"].to_dict()

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

    def proses_satu_kasus(cid, subtipe, row_masukan, riwayat_list, k_pagu, k_nilai, k_mulai, k_durasi, k_tahap, k_akad_prj, is_prj_sah=True, prj_ktr=None):
        nonlocal case_counter
        p_ktr = prj_ktr or str(peta_kontrak.get(row_masukan["kontrak_id"], ""))
        kum_prev = sum(r["nilai_pencairan"] for r in riwayat_list)

        fitur_dict = hitung_fitur_satu_transaksi(
            row_masukan,
            riwayat_list,
            k_pagu,
            k_nilai,
            tanggal_mulai_kontrak=k_mulai,
            referensi_kelompok=referensi_kelompok,
            durasi_bulan=k_durasi,
            tahap_proyek=k_tahap,
        )

        hasil_aturan = periksa_aturan_transaksi(
            row_masukan,
            proyek_sah,
            peta_kontrak,
            k_pagu,
            kumulatif_cair_sebelumnya=kum_prev,
            config=cfg,
            peta_proyek_ke_akad=peta_akad,
            akad_proyek=k_akad_prj,
        )
        aturan_terpicu = [t["kode"] for t in hasil_aturan["temuan"]]
        lolos_aturan = hasil_aturan["lolos"]

        vec_feat = np.array([[fitur_dict[f] for f in DAFTAR_FITUR]])
        skor_raw = float(hitung_skor_iforest(model, vec_feat)[0])

        if not lolos_aturan:
            keputusan = "peringatan_aturan"
        elif skor_raw >= ambang:
            keputusan = "peringatan_skor"
        else:
            keputusan = "wajar"

        kasus_obj = {
            "id": f"g-{case_counter:04d}",
            "subtipe": subtipe,
            "kontrak_id": row_masukan["kontrak_id"],
            "masukan": row_masukan,
            "riwayat": riwayat_list,
            "konteks": {
                "project_id_kontrak": p_ktr,
                "project_id_sah": is_prj_sah,
                "akad_proyek": k_akad_prj,
                "durasi_bulan": int(k_durasi),
                "tahap_proyek": str(k_tahap),
                "bulan_ke": int(row_masukan.get("bulan_ke", 1)),
                "pagu_alokasi_kontrak": int(k_pagu),
                "nilai_kontrak": int(k_nilai),
                "tanggal_mulai_kontrak": str(k_mulai),
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
        }
        case_counter += 1
        return kasus_obj

    for idx in idx_terpilih:
        row = df_sorted.iloc[idx]
        kid = row["kontrak_id"]
        tgl_curr = row["tanggal"]
        pagu = float(row["pagu_alokasi_kontrak"])
        nilai_k = float(row["nilai_kontrak"])
        tgl_mulai = peta_mulai.get(kid, str(tgl_curr))
        dur_k = int(peta_durasi.get(kid, 12))
        tahap_k = str(row["tahap_proyek"])
        prj_milik_ktr = str(peta_kontrak.get(kid, ""))
        akad_prj = str(peta_akad.get(prj_milik_ktr, ""))

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
            "akad": str(row["akad"]),
            "hash_tercatat": str(row["hash_tercatat"]),
            "hash_dokumen_saat_ini": str(row["hash_dokumen_saat_ini"]),
            "bulan_ke": int(row["bulan_ke"]),
        }

        kasus_list.append(
            proses_satu_kasus(
                case_counter, str(row["subtipe_kasus"]), masukan, riwayat,
                pagu, nilai_k, tgl_mulai, dur_k, tahap_k, akad_prj,
                is_prj_sah=str(row["project_id"]) in proyek_sah, prj_ktr=prj_milik_ktr,
            )
        )

    # Tambahkan kasus pinggiran eksplisit sesuai EXPORT_SPEC.md bagian 3:
    base_sample = kasus_list[0]
    base_m = dict(base_sample["masukan"])
    base_k = dict(base_sample["konteks"])
    base_riw = list(base_sample["riwayat"])

    # Edge case 1: bulan_ke melewati durasi_bulan (u diklem ke 1.0)
    m_edge1 = dict(base_m, bulan_ke=base_k["durasi_bulan"] + 10)
    kasus_list.append(proses_satu_kasus(
        case_counter, "edge_bulan_melewati_durasi", m_edge1, base_riw,
        base_k["pagu_alokasi_kontrak"], base_k["nilai_kontrak"], base_k["tanggal_mulai_kontrak"],
        base_k["durasi_bulan"], base_k["tahap_proyek"], base_k["akad_proyek"],
        is_prj_sah=base_k["project_id_sah"], prj_ktr=base_k["project_id_kontrak"],
    ))

    # Edge case 2: bulan_ke == 0 (u = 0)
    m_edge2 = dict(base_m, bulan_ke=0, jenis_pembayaran="uang_muka")
    kasus_list.append(proses_satu_kasus(
        case_counter, "edge_bulan_nol", m_edge2, [],
        base_k["pagu_alokasi_kontrak"], base_k["nilai_kontrak"], base_k["tanggal_mulai_kontrak"],
        base_k["durasi_bulan"], "persiapan", base_k["akad_proyek"],
        is_prj_sah=base_k["project_id_sah"], prj_ktr=base_k["project_id_kontrak"],
    ))

    # Edge case 3: kategori tidak dikenal (fallback median per tahap / global)
    m_edge3 = dict(base_m, kategori_hijau="Kategori Fiktif Tidak Ada")
    kasus_list.append(proses_satu_kasus(
        case_counter, "edge_kategori_tidak_dikenal", m_edge3, base_riw,
        base_k["pagu_alokasi_kontrak"], base_k["nilai_kontrak"], base_k["tanggal_mulai_kontrak"],
        base_k["durasi_bulan"], base_k["tahap_proyek"], base_k["akad_proyek"],
        is_prj_sah=base_k["project_id_sah"], prj_ktr=base_k["project_id_kontrak"],
    ))

    # Edge case 4: akad kosong (memakai akad registri proyek sehingga lolos R08)
    m_edge4 = dict(base_m, akad="")
    kasus_list.append(proses_satu_kasus(
        case_counter, "edge_akad_kosong", m_edge4, base_riw,
        base_k["pagu_alokasi_kontrak"], base_k["nilai_kontrak"], base_k["tanggal_mulai_kontrak"],
        base_k["durasi_bulan"], base_k["tahap_proyek"], base_k["akad_proyek"],
        is_prj_sah=base_k["project_id_sah"], prj_ktr=base_k["project_id_kontrak"],
    ))

    # Edge case 5: project_id tidak valid dengan akad beda (hanya R01 terpicu, R08 tidak)
    m_edge5 = dict(base_m, project_id="PRJ-9999", akad="Wakalah" if base_k["akad_proyek"] != "Wakalah" else "Ijarah Asset to Be Leased")
    kasus_list.append(proses_satu_kasus(
        case_counter, "edge_proj_invalid_akad_beda", m_edge5, base_riw,
        base_k["pagu_alokasi_kontrak"], base_k["nilai_kontrak"], base_k["tanggal_mulai_kontrak"],
        base_k["durasi_bulan"], base_k["tahap_proyek"], base_k["akad_proyek"],
        is_prj_sah=False, prj_ktr=base_k["project_id_kontrak"],
    ))

    # Edge case 6: kelengkapan bukti tepat 0.80 (lolos R07)
    m_edge6 = dict(base_m, kelengkapan_bukti=0.80)
    kasus_list.append(proses_satu_kasus(
        case_counter, "edge_bukti_tepat_ambang", m_edge6, base_riw,
        base_k["pagu_alokasi_kontrak"], base_k["nilai_kontrak"], base_k["tanggal_mulai_kontrak"],
        base_k["durasi_bulan"], base_k["tahap_proyek"], base_k["akad_proyek"],
        is_prj_sah=base_k["project_id_sah"], prj_ktr=base_k["project_id_kontrak"],
    ))

    # Kasus uji kanonikalisasi dan hash ledger
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
        "versi_skema": 2,
        "dibuat_pada": datetime.now().strftime("%Y-%m-%d"),
        "jumlah_kasus": len(kasus_list),
        "kasus": kasus_list,
        "ledger_kanonik_cases": ledger_cases,
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(golden_data, f, ensure_ascii=False, indent=2)
    print(f"Golden cases tersimpan di: {out_path} ({len(kasus_list)} kasus, {os.path.getsize(out_path):,} bytes)")


def main():
    print("=== Mengekspor Artefak Model dan Kasus Emas (Fase R4-R5) ===")
    os.makedirs(ARTIFACTS_DIR, exist_ok=True)
    os.makedirs(WEB_ARTIFACTS_DIR, exist_ok=True)

    cfg = muat_konfigurasi_aturan()

    # Muat data simulasi
    df_trx = pd.read_csv(os.path.join(DATA_DIR, "transaksi_gstp.csv"))
    df_prj = pd.read_csv(os.path.join(DATA_DIR, "registri_proyek.csv"))
    df_ktr = pd.read_csv(os.path.join(DATA_DIR, "registri_kontrak.csv"))

    # Latih model pada split pengembangan lolos aturan
    melanggar = evaluasi_aturan_dataframe(df_trx, df_prj, df_ktr, config=cfg)
    df_dev_lolos = df_trx[(df_trx["split"] == "pengembangan") & (~melanggar)]

    # 1. Hitung referensi kelompok dari split pengembangan lolos aturan
    ref_kelompok = hitung_referensi_kelompok(df_dev_lolos)
    peta_durasi = df_ktr.set_index("kontrak_id")["durasi_bulan"].to_dict()

    X_dev = bangun_fitur_dataframe(
        df_dev_lolos,
        referensi_kelompok=ref_kelompok,
        peta_durasi_kontrak=peta_durasi,
    ).values

    print(f"1. Melatih Isolation Forest dengan {X_dev.shape[1]} fitur (seed 42)...")
    model = latih_model_isolation_forest(X_dev, seed=42)

    # 2. Tentukan ambang dari split validasi lolos aturan
    df_val = df_trx[df_trx["split"] == "validasi"]
    mel_val = melanggar[df_trx["split"] == "validasi"].values
    X_val = bangun_fitur_dataframe(
        df_val,
        referensi_kelompok=ref_kelompok,
        peta_durasi_kontrak=peta_durasi,
    ).values
    skor_val = hitung_skor_iforest(model, X_val)
    y_val = df_val["label_anomali"].values
    ambang, f1_val, far_val = tentukan_ambang_validasi(skor_val[~mel_val], y_val[~mel_val], max_far=0.02)

    print(f"2. Ambang model validasi: {ambang:.4f} (F1 val: {f1_val:.4f}, FAR val: {far_val:.4f})")

    # 3. rules_config.json
    rules_cfg_path = os.path.join(ARTIFACTS_DIR, "rules_config.json")
    cfg_export = dict(cfg)
    cfg_export["versi"] = 2
    cfg_export["prinsip"] = dict(PETA_PRINSIP)
    cfg_export["versi_skema"] = 1
    cfg_export["dibuat_pada"] = datetime.now().strftime("%Y-%m-%d")
    with open(rules_cfg_path, "w", encoding="utf-8") as f:
        json.dump(cfg_export, f, ensure_ascii=False, indent=2)

    # 4. model_if.json
    model_out_path = os.path.join(ARTIFACTS_DIR, "model_if.json")
    ekspor_model_if(model, ambang, ref_kelompok, model_out_path)

    # 5. golden_cases.json
    golden_out_path = os.path.join(ARTIFACTS_DIR, "golden_cases.json")
    bangun_golden_cases(df_trx, df_prj, df_ktr, model, ambang, ref_kelompok, cfg, golden_out_path)

    # 6. Salin artefak ke web/data/artifacts/
    for fname in ["rules_config.json", "model_if.json", "golden_cases.json"]:
        src = os.path.join(ARTIFACTS_DIR, fname)
        dst = os.path.join(WEB_ARTIFACTS_DIR, fname)
        shutil.copyfile(src, dst)
        print(f"Disalin ke: {dst}")

    print("\nEkspor artefak selesai dengan sukses.")


if __name__ == "__main__":
    main()
