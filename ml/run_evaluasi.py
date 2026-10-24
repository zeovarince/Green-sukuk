"""
ml/run_evaluasi.py
==================
Evaluasi tiga pendekatan GSTP (Aturan Saja, Isolation Forest Saja, Hybrid)
sesuai docs/EVALUATION.md.

Menghitung metrik pada data pengujian:
- Precision, Recall, F1, False Alarm Rate, Peringatan per 1.000 transaksi
- Recall per subtipe anomali
- False alarm rate pada kelompok normal_tidak_lazim_sah
- Rata-rata dan simpangan baku dari 5 seed (42, 43, 44, 45, 46)
- Latensi pemrosesan per transaksi
- Menulis ml/artifacts/hasil_evaluasi.json
"""

import json
import os
import time
from datetime import datetime
import numpy as np
import pandas as pd

from gstp.aturan import evaluasi_aturan_dataframe, muat_konfigurasi_aturan
from gstp.fitur import DAFTAR_FITUR, bangun_fitur_dataframe
from gstp.model import latih_model_isolation_forest, hitung_skor_iforest, tentukan_ambang_validasi

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ARTIFACTS_DIR = os.path.join(BASE_DIR, "artifacts")
DATA_DIR = os.path.join(BASE_DIR, "data_simulasi")


def hitung_metrik_klasifikasi(pred: np.ndarray, y_true: np.ndarray) -> dict:
    tp = int(((pred == 1) & (y_true == 1)).sum())
    fp = int(((pred == 1) & (y_true == 0)).sum())
    fn = int(((pred == 0) & (y_true == 1)).sum())
    tn = int(((pred == 0) & (y_true == 0)).sum())

    n = len(y_true)
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
    far = fp / (fp + tn) if (fp + tn) > 0 else 0.0
    per_1000 = (1000.0 * (tp + fp)) / n if n > 0 else 0.0

    return {
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "far": round(far, 4),
        "peringatan_per_1000": round(per_1000, 2),
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "tn": tn,
    }


def evaluasi_satu_dataset(df_trx, df_prj, df_ktr, cfg, seed: int = 42):
    # Evaluasi aturan
    melanggar = evaluasi_aturan_dataframe(df_trx, df_prj, df_ktr, config=cfg)

    # Pisahkan split
    mask_dev = df_trx["split"] == "pengembangan"
    mask_val = df_trx["split"] == "validasi"
    mask_test = df_trx["split"] == "pengujian"

    # Data latih: split pengembangan, hanya baris lolos aturan, tanpa label
    df_dev_lolos = df_trx[mask_dev & (~melanggar)]
    X_dev = bangun_fitur_dataframe(df_dev_lolos).values

    # Latih model Isolation Forest
    model = latih_model_isolation_forest(X_dev, seed=seed)

    # Validasi
    df_val = df_trx[mask_val].copy().reset_index(drop=True)
    mel_val = melanggar[mask_val].values
    X_val = bangun_fitur_dataframe(df_val).values
    skor_val = hitung_skor_iforest(model, X_val)
    y_val = df_val["label_anomali"].values

    # Penentuan ambang hybrid: pada baris lolos aturan di validasi
    skor_val_lolos = skor_val[~mel_val]
    y_val_lolos = y_val[~mel_val]
    ambang_hybrid, f1_val_h, far_val_h = tentukan_ambang_validasi(skor_val_lolos, y_val_lolos, max_far=0.02)

    # Penentuan ambang iforest_saja: pada SELURUH baris validasi
    ambang_iforest, f1_val_if, far_val_if = tentukan_ambang_validasi(skor_val, y_val, max_far=0.02)

    # Pengujian
    df_test = df_trx[mask_test].copy().reset_index(drop=True)
    mel_test = melanggar[mask_test].values
    X_test = bangun_fitur_dataframe(df_test).values
    skor_test = hitung_skor_iforest(model, X_test)
    y_test = df_test["label_anomali"].values

    # Prediksi 3 pendekatan pada test set:
    # 1. Aturan saja
    pred_aturan = mel_test.astype(int)

    # 2. Isolation Forest saja (dinilai pada seluruh transaksi)
    pred_iforest = (skor_test >= ambang_iforest).astype(int)

    # 3. Hybrid: melanggar aturan ATAU (lolos aturan DAN skor >= ambang_hybrid)
    pred_hybrid = (mel_test | ((~mel_test) & (skor_test >= ambang_hybrid))).astype(int)

    metrik_aturan = hitung_metrik_klasifikasi(pred_aturan, y_test)
    metrik_iforest = hitung_metrik_klasifikasi(pred_iforest, y_test)
    metrik_hybrid = hitung_metrik_klasifikasi(pred_hybrid, y_test)

    # Recall per subtipe
    subtipe_list = sorted(df_test["subtipe_kasus"].unique())
    recall_subtipe = {}
    for st in subtipe_list:
        mask_st = (df_test["subtipe_kasus"] == st).values
        n_st = int(mask_st.sum())
        is_anomali = df_test.loc[mask_st, "label_anomali"].iloc[0] == 1
        if is_anomali:
            r_at = float(pred_aturan[mask_st].sum()) / n_st if n_st > 0 else 0.0
            r_if = float(pred_iforest[mask_st].sum()) / n_st if n_st > 0 else 0.0
            r_hy = float(pred_hybrid[mask_st].sum()) / n_st if n_st > 0 else 0.0
            recall_subtipe[st] = {
                "n": n_st,
                "aturan_saja": round(r_at, 4),
                "iforest_saja": round(r_if, 4),
                "hybrid": round(r_hy, 4),
            }

    # False alarm pada normal_tidak_lazim_sah
    mask_sah = (df_test["kelompok_kasus"] == "normal_tidak_lazim_sah").values
    n_sah = int(mask_sah.sum())
    far_sah_at = float(pred_aturan[mask_sah].sum()) / n_sah if n_sah > 0 else 0.0
    far_sah_if = float(pred_iforest[mask_sah].sum()) / n_sah if n_sah > 0 else 0.0
    far_sah_hy = float(pred_hybrid[mask_sah].sum()) / n_sah if n_sah > 0 else 0.0

    return {
        "ambang_hybrid": ambang_hybrid,
        "f1_val_hybrid": f1_val_h,
        "far_val_hybrid": far_val_h,
        "ambang_iforest": ambang_iforest,
        "pengujian": {
            "aturan_saja": metrik_aturan,
            "iforest_saja": metrik_iforest,
            "hybrid": metrik_hybrid,
        },
        "recall_per_subtipe": recall_subtipe,
        "false_alarm_normal_tidak_lazim_sah": {
            "n": n_sah,
            "aturan_saja": round(far_sah_at, 4),
            "iforest_saja": round(far_sah_if, 4),
            "hybrid": round(far_sah_hy, 4),
        },
        "model": model,
        "X_test": X_test,
    }


def main():
    print("=== Menjalankan Evaluasi GSTP (Fase 4) ===")
    cfg = muat_konfigurasi_aturan()

    trx_path = os.path.join(DATA_DIR, "transaksi_gstp.csv")
    prj_path = os.path.join(DATA_DIR, "registri_proyek.csv")
    ktr_path = os.path.join(DATA_DIR, "registri_kontrak.csv")

    df_trx = pd.read_csv(trx_path)
    df_prj = pd.read_csv(prj_path)
    df_ktr = pd.read_csv(ktr_path)

    # 1. Jalankan seed utama (42)
    print("\n1. Mengevaluasi seed utama (seed 42)...")
    t0 = time.time()
    hasil_42 = evaluasi_satu_dataset(df_trx, df_prj, df_ktr, cfg, seed=42)
    t_eval = time.time() - t0

    # Ukur latensi inferensi per transaksi (batch 500 transaksi)
    model_42 = hasil_42["model"]
    X_sample = hasil_42["X_test"][:500]
    t_lat0 = time.time()
    _ = hitung_skor_iforest(model_42, X_sample)
    latensi_ms_lokal = ((time.time() - t_lat0) / len(X_sample)) * 1000.0

    # 2. Jalankan beberapa seed (42, 43, 44, 45, 46) untuk kestabilan model iForest
    seeds = [42, 43, 44, 45, 46]
    print(f"\n2. Mengevaluasi 5 seed ({seeds}) untuk kestabilan model...")
    list_f1_hybrid = []
    list_far_hybrid = []
    list_f1_iforest = []
    list_far_iforest = []

    for s in seeds:
        res_s = evaluasi_satu_dataset(df_trx, df_prj, df_ktr, cfg, seed=s)
        list_f1_hybrid.append(res_s["pengujian"]["hybrid"]["f1"])
        list_far_hybrid.append(res_s["pengujian"]["hybrid"]["far"])
        list_f1_iforest.append(res_s["pengujian"]["iforest_saja"]["f1"])
        list_far_iforest.append(res_s["pengujian"]["iforest_saja"]["far"])
        print(f"  Seed {s} -> F1 Hybrid: {res_s['pengujian']['hybrid']['f1']}, FAR: {res_s['pengujian']['hybrid']['far']}")

    f1_hy_mean = float(np.mean(list_f1_hybrid))
    f1_hy_sd = float(np.std(list_f1_hybrid))
    far_hy_mean = float(np.mean(list_far_hybrid))
    far_hy_sd = float(np.std(list_far_hybrid))

    hasil_evaluasi_json = {
        "dibuat_pada": datetime.now().strftime("%Y-%m-%d"),
        "seed_utama": 42,
        "ambang": {
            "nilai": round(float(hasil_42["ambang_hybrid"]), 4),
            "cara": "maks F1 validasi baris lolos aturan dengan batas FAR 2 persen",
            "f1_validasi": round(float(hasil_42["f1_val_hybrid"]), 4),
            "far_validasi": round(float(hasil_42["far_val_hybrid"]), 4),
            "ambang_iforest_saja": round(float(hasil_42["ambang_iforest"]), 4),
        },
        "pengujian": hasil_42["pengujian"],
        "recall_per_subtipe": hasil_42["recall_per_subtipe"],
        "false_alarm_normal_tidak_lazim_sah": hasil_42["false_alarm_normal_tidak_lazim_sah"],
        "beberapa_seed": {
            "seed": seeds,
            "f1_hybrid_rerata": round(f1_hy_mean, 4),
            "f1_hybrid_sd": round(f1_hy_sd, 4),
            "far_hybrid_rerata": round(far_hy_mean, 4),
            "far_hybrid_sd": round(far_hy_sd, 4),
        },
        "latensi_ms": {
            "lokal": round(latensi_ms_lokal, 2),
            "vercel": 0.0,
        },
    }

    os.makedirs(ARTIFACTS_DIR, exist_ok=True)
    out_path = os.path.join(ARTIFACTS_DIR, "hasil_evaluasi.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(hasil_evaluasi_json, f, ensure_ascii=False, indent=2)

    print(f"\nArtefak tersimpan di: {out_path}")
    print("\n=== TABEL UTAMA (DATA PENGUJIAN) ===")
    df_ringkas = pd.DataFrame([
        {"Pendekatan": "Aturan saja", **hasil_42["pengujian"]["aturan_saja"]},
        {"Pendekatan": "Isolation Forest saja", **hasil_42["pengujian"]["iforest_saja"]},
        {"Pendekatan": "Hybrid", **hasil_42["pengujian"]["hybrid"]},
    ])
    kolom_tampil = ["Pendekatan", "precision", "recall", "f1", "far", "peringatan_per_1000"]
    print(df_ringkas[kolom_tampil].to_string(index=False))

    print("\n=== RECALL PER SUBTIPE (DATA PENGUJIAN) ===")
    df_sub = pd.DataFrame.from_dict(hasil_42["recall_per_subtipe"], orient="index")
    print(df_sub.to_string())

    print("\n=== EVALUASI BEBERAPA SEED (HYBRID) ===")
    print(f"F1 Hybrid (rerata ± SD) : {f1_hy_mean:.4f} ± {f1_hy_sd:.4f}")
    print(f"FAR Hybrid (rerata ± SD): {far_hy_mean:.4f} ± {far_hy_sd:.4f}")


if __name__ == "__main__":
    main()
