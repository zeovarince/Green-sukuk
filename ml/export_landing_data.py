"""Export source-backed JSON used by the static GSTP landing page."""

from __future__ import annotations

import csv
import gzip
import json
import math
import sys
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
ML_DIR = ROOT / "ml"
DATA_DIR = ML_DIR / "data_simulasi"
ARTIFACTS_DIR = ML_DIR / "artifacts"
OUT_DIR = ROOT / "web" / "data" / "landing"
sys.path.insert(0, str(ML_DIR))

from gstp.aturan import evaluasi_aturan_dataframe, muat_konfigurasi_aturan  # noqa: E402
from gstp.fitur import bangun_fitur_dataframe  # noqa: E402


def _c_factor(n: int) -> float:
    if n <= 1:
        return 0.0
    if n == 2:
        return 1.0
    return 2 * (math.log(n - 1) + 0.5772156649) - 2 * (n - 1) / n


def _score_forest(model: dict, matrix: np.ndarray) -> np.ndarray:
    """Score rows with the same exported tree representation used by the web app."""
    path_lengths = np.zeros(len(matrix), dtype=float)
    for tree in model["pohon"]:
        features = tree["fitur"]
        thresholds = tree["ambang"]
        left = tree["kiri"]
        right = tree["kanan"]
        samples = tree["n_sampel"]
        for row_index, vector in enumerate(matrix):
            node = 0
            depth = 0
            while features[node] >= 0:
                feature_index = features[node]
                node = left[node] if vector[feature_index] <= thresholds[node] else right[node]
                depth += 1
            path_lengths[row_index] += depth + _c_factor(samples[node])
    average = path_lengths / len(model["pohon"])
    return np.power(2.0, -average / float(model["c_max_samples"]))


def _read_csv(name: str) -> pd.DataFrame:
    return pd.read_csv(DATA_DIR / name)


def _write_json(name: str, payload: dict) -> None:
    path = OUT_DIR / name
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def _build_curve(transactions: pd.DataFrame) -> dict:
    cases = transactions[
        (transactions["label_anomali"] == 1)
        & (transactions["subtipe_kasus"] == "lonjakan_tanpa_progres")
    ].sort_values(["tanggal", "kontrak_id", "trx_id"], kind="mergesort")
    if cases.empty:
        raise RuntimeError("No lonjakan_tanpa_progres transaction exists for the curve example.")

    selected: tuple[pd.DataFrame, pd.Series, float] | None = None
    for _, flagged in cases.iterrows():
        history = transactions[transactions["kontrak_id"] == flagged["kontrak_id"]].sort_values(
            ["tanggal", "trx_id"], kind="mergesort"
        )
        if len(history) < 2:
            continue
        payout = float(flagged["kumulatif_cair"]) / max(float(flagged["nilai_kontrak"]), 1.0)
        progress = float(flagged["progres_fisik_pct"]) / 100.0
        gap = (payout - progress) * 100
        if selected is None or gap > selected[2]:
            selected = (history, flagged, gap)

    if selected is None:
        raise RuntimeError("Could not find a curve example with transaction history.")

    history, flagged, gap = selected
    start = pd.to_datetime(history["tanggal"].min())
    end = pd.to_datetime(history["tanggal"].max())
    span = max((end - start).days, 1)
    raw_points = []
    for _, row in history.iterrows():
        u = (pd.to_datetime(row["tanggal"]) - start).days / span
        raw_points.append({
            "u": round(float(u), 4),
            "progres": round(min(max(float(row["progres_fisik_pct"]) / 100.0, 0.0), 1.0), 4),
            "pencairan": round(min(max(float(row["kumulatif_cair"]) / max(float(row["nilai_kontrak"]), 1.0), 0.0), 1.0), 4),
            "trx_id": str(row["trx_id"]),
        })

    if len(raw_points) > 80:
        positions = np.linspace(0, len(raw_points) - 1, 80).round().astype(int)
        raw_points = [raw_points[index] for index in sorted(set(positions.tolist()))]

    flagged_u = (pd.to_datetime(flagged["tanggal"]) - start).days / span
    return {
        "simulasi": True,
        "seed": 42,
        "dibuat_pada": date.today().isoformat(),
        "kontrak_id": str(flagged["kontrak_id"]),
        "jenis_kasus": "lonjakan_tanpa_progres",
        "titik": [{k: v for k, v in point.items() if k != "trx_id"} for point in raw_points],
        "ditandai": {"u": round(float(flagged_u), 4), "selisih_poin": round(float(gap), 2)},
    }


def _build_cloud(transactions: pd.DataFrame, projects: pd.DataFrame, contracts: pd.DataFrame, metrics: dict) -> dict:
    config = muat_konfigurasi_aturan(str(ARTIFACTS_DIR / "rules_config.json"))
    model = json.loads((ROOT / "web" / "data" / "artifacts" / "model_if.json").read_text(encoding="utf-8"))
    threshold = float(metrics["ambang"]["nilai"])

    test = transactions[transactions["split"] == "pengujian"].copy()
    test = test.sort_values(["tanggal", "kontrak_id"], kind="mergesort").reset_index(drop=True)
    rule_flag = evaluasi_aturan_dataframe(test, projects, contracts, config=config).to_numpy(dtype=bool)
    features = bangun_fitur_dataframe(test)
    scores = _score_forest(model, features.to_numpy())
    hybrid_flag = rule_flag | ((~rule_flag) & (scores >= threshold))

    rng = np.random.default_rng(42)
    marked = np.flatnonzero(hybrid_flag)
    non_marked = np.flatnonzero(~hybrid_flag)
    limit = 8000
    take_marked = marked[:limit]
    remaining = limit - len(take_marked)

    # Keep every alert and deliberately oversample unmarked synthetic anomalies so
    # the landing's point cloud remains readable without implying population rates.
    anomaly = test["label_anomali"].to_numpy(dtype=int) == 1
    overall_rate = float((transactions["label_anomali"] == 1).mean())
    sample_size = min(limit, len(test))
    non_marked_anomaly = non_marked[anomaly[non_marked]]
    extra_anomaly = rng.choice(non_marked_anomaly, size=min(remaining, len(non_marked_anomaly)), replace=False) if remaining and len(non_marked_anomaly) else np.array([], dtype=int)
    remaining -= len(extra_anomaly)
    non_marked_normal = non_marked[~anomaly[non_marked]]
    extra_normal = rng.choice(non_marked_normal, size=min(remaining, len(non_marked_normal)), replace=False) if remaining else np.array([], dtype=int)
    selected = np.concatenate([take_marked, extra_anomaly, extra_normal])

    dates = pd.to_datetime(test["tanggal"])
    day_span = max(int((dates.max() - dates.min()).days), 1)
    elapsed = (dates - dates.min()).dt.days.to_numpy(dtype=float) / day_span
    values = np.log1p(test["nilai_pencairan"].to_numpy(dtype=float))
    low, high = float(values.min()), float(values.max())
    value_norm = (values - low) / max(high - low, 1e-9)
    contract_codes, _ = pd.factorize(test["kontrak_id"], sort=True)
    code_norm = contract_codes.astype(float) / max(int(contract_codes.max()), 1)

    sample = []
    for index in selected:
        sample.append({
            "x": round(float(elapsed[index]), 4),
            "y": round(float(value_norm[index]), 4),
            "z": round(float(code_norm[index]), 4),
            "a": int(rule_flag[index]),
            "k": None if rule_flag[index] else round(float(scores[index]), 4),
            "d": int(hybrid_flag[index]),
        })

    sample_anomaly_rate = float(anomaly[selected].mean()) if len(selected) else 0.0
    if sample_anomaly_rate <= overall_rate:
        raise RuntimeError("The point cloud anomaly sample must exceed the source anomaly proportion.")

    return {
        "simulasi": True,
        "seed": 42,
        "dibuat_pada": date.today().isoformat(),
        "total": int(len(transactions)),
        "anomali": int(transactions["label_anomali"].sum()),
        "ambang": round(threshold, 4),
        "catatan_sampel": "Sampel visual distratifikasi dan proporsi anomali lebih tinggi dari data asli.",
        "n_sampel": len(sample),
        "proporsi_anomali_sumber": round(overall_rate, 6),
        "proporsi_anomali_sampel": round(sample_anomaly_rate, 6),
        "peringatan_aturan_sampel": int(sum(point["a"] for point in sample)),
        "peringatan_skor_sampel": int(sum(point["d"] == 1 and point["a"] == 0 for point in sample)),
        "peringatan_hybrid_sampel": int(sum(point["d"] for point in sample)),
        "sampel": sample,
    }


def _build_chain() -> dict:
    entries = []
    with (DATA_DIR / "ledger_entri_awal.csv").open(encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream):
            if len(entries) >= 22:
                break
            entries.append({
                "seq": int(row["seq"]),
                "jenis": str(row["jenis_entri"]),
                "hash": str(row["hash_saat_ini"])[:8],
            })
    if len(entries) < 18:
        raise RuntimeError("At least 18 initial ledger entries are required for the example.")
    return {
        "simulasi": True,
        "dibuat_pada": date.today().isoformat(),
        "entri": entries,
        "rusak_pada": entries[min(11, len(entries) - 1)]["seq"],
        "catatan": "Ilustrasi sengaja memutus satu tautan; bukan hasil manipulasi ledger produksi.",
    }


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    transactions = _read_csv("transaksi_gstp.csv")
    transactions["tanggal"] = pd.to_datetime(transactions["tanggal"])
    projects = _read_csv("registri_proyek.csv")
    contracts = _read_csv("registri_kontrak.csv")
    metrics = json.loads((ARTIFACTS_DIR / "hasil_evaluasi.json").read_text(encoding="utf-8"))
    model_info = json.loads((ROOT / "web" / "data" / "artifacts" / "model_if.json").read_text(encoding="utf-8"))

    curve = _build_curve(transactions)
    cloud = _build_cloud(transactions, projects, contracts, metrics)
    chain = _build_chain()
    evaluation = {"tersedia": True, "versi_model": model_info["versi_model"], **metrics}

    _write_json("kurva_contoh.json", curve)
    _write_json("awan_transaksi.json", cloud)
    _write_json("rantai_contoh.json", chain)
    _write_json("evaluasi.json", evaluation)

    files = sorted(OUT_DIR.glob("*.json"))
    compressed = sum(len(gzip.compress(path.read_bytes(), compresslevel=9)) for path in files)
    if compressed >= 500_000:
        raise RuntimeError(f"Compressed landing data is {compressed:,} bytes, over the 500 KB limit.")
    print(f"generated={len(files)} files")
    print(f"curve_contract={curve['kontrak_id']} curve_gap={curve['ditandai']['selisih_poin']}pp")
    print(f"cloud_points={cloud['n_sampel']} source_anomaly={cloud['proporsi_anomali_sumber']} sample_anomaly={cloud['proporsi_anomali_sampel']}")
    print(f"compressed_total={compressed} bytes")


if __name__ == "__main__":
    main()
