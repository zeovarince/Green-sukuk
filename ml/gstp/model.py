"""
ml/gstp/model.py
================
Pelatihan model Isolation Forest dan penentuan ambang batas anomali
sesuai docs/MODEL_SPEC.md.
"""

from __future__ import annotations
import math
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from typing import Any, Dict, Optional, Tuple

from gstp.fitur import DAFTAR_FITUR, bangun_fitur_dataframe
from gstp.aturan import evaluasi_aturan_dataframe, muat_konfigurasi_aturan


def c_factor(n: float | int) -> float:
    """
    Faktor normalisasi panjang jalur rata-rata pohon biner acak (Euler-Mascheroni constant).
    c(n) = 2 * (ln(n - 1) + 0.5772156649) - 2 * (n - 1) / n untuk n > 2
    c(2) = 1, c(n) = 0 untuk n <= 1
    """
    if n <= 1:
        return 0.0
    if n == 2:
        return 1.0
    n = float(n)
    return 2.0 * (math.log(n - 1.0) + 0.5772156649) - (2.0 * (n - 1.0) / n)


def hitung_skor_iforest(model: IsolationForest, X: np.ndarray) -> np.ndarray:
    """
    Menghitung skor anomali s in [0, 1] menggunakan formula:
    s = -score_samples(X)
    Pada scikit-learn, score_samples bernilai [-1, 0], sehingga -score_samples bernilai [0, 1].
    Skor mendekati 1 berarti semakin anomali.
    """
    return -model.score_samples(X)


def latih_model_isolation_forest(
    X_train: np.ndarray | pd.DataFrame,
    seed: int = 42,
    n_estimators: int = 200,
    max_samples: int = 256,
) -> IsolationForest:
    """
    Melatih Isolation Forest dengan parameter awal MODEL_SPEC.md:
    n_estimators: 200, max_samples: 256, contamination: 'auto', random_state: seed.
    """
    model = IsolationForest(
        n_estimators=n_estimators,
        max_samples=max_samples,
        contamination="auto",
        max_features=1.0,
        random_state=seed,
        n_jobs=-1,
    )
    model.fit(X_train)
    return model


def tentukan_ambang_validasi(
    skor_val: np.ndarray,
    label_val: np.ndarray,
    max_far: float = 0.02,
) -> Tuple[float, float, float]:
    """
    Menentukan ambang skor pada split validasi:
    Memaksimalkan F1 dengan batas False Alarm Rate (FAR = FP / (FP + TN)) <= max_far (default 2%).

    Mengembalikan: (ambang_terbaik, f1_terbaik, far_terbaik)
    """
    skor_unik = np.unique(skor_val)
    skor_unik.sort()

    y_true = np.asarray(label_val, dtype=int)
    n_negatif = int((y_true == 0).sum())
    n_positif = int((y_true == 1).sum())

    if n_positif == 0 or n_negatif == 0:
        return 0.5, 0.0, 0.0

    # Cari kandidat threshold yang memenuhi FAR <= max_far
    # Untuk memastikan batas ketat FAR <= max_far, cari dari skor unik atau sampel
    ambang_terbaik = float(skor_unik[-1])
    f1_terbaik = -1.0
    far_terbaik = 0.0

    # Lakukan pencarian threshold
    for th in skor_unik:
        pred = (skor_val >= th).astype(int)
        fp = int(((pred == 1) & (y_true == 0)).sum())
        tn = int(((pred == 0) & (y_true == 0)).sum())
        far = fp / (fp + tn) if (fp + tn) > 0 else 0.0

        if far <= max_far:
            tp = int(((pred == 1) & (y_true == 1)).sum())
            fn = int(((pred == 0) & (y_true == 1)).sum())
            precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
            recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
            f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

            if f1 > f1_terbaik:
                f1_terbaik = f1
                ambang_terbaik = float(th)
                far_terbaik = far

    # Jika f1_terbaik tetap 0 (semua candidate FAR<=max_far memiliki TP=0):
    # Pilih threshold terendah yang masih memenuhi FAR <= max_far (anggaran alarm 2%)
    if f1_terbaik <= 0.0:
        neg_scores = np.sort(skor_val[y_true == 0])
        target_fp = int(np.floor(len(neg_scores) * max_far))
        if target_fp > 0:
            ambang_terbaik = float(neg_scores[-target_fp])
        else:
            ambang_terbaik = float(neg_scores[-1])

        pred = (skor_val >= ambang_terbaik).astype(int)
        tp = int(((pred == 1) & (y_true == 1)).sum())
        fp = int(((pred == 1) & (y_true == 0)).sum())
        fn = int(((pred == 0) & (y_true == 1)).sum())
        tn = int(((pred == 0) & (y_true == 0)).sum())
        far_terbaik = fp / (fp + tn) if (fp + tn) > 0 else 0.0
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1_terbaik = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

    return ambang_terbaik, f1_terbaik, far_terbaik
