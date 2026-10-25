import model from "@/data/artifacts/model_if.json";
import { DAFTAR_FITUR, type NamaFitur, type VektorFitur } from "./fitur";

type Pohon = (typeof model.pohon)[number];

function cFactor(n: number): number {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1)) / n;
}

function panjangJalur(pohon: Pohon, fitur: number[]): number {
  let node = 0;
  let depth = 0;
  while (pohon.fitur[node] >= 0) {
    const featureIndex = pohon.fitur[node];
    node = fitur[featureIndex] <= pohon.ambang[node] ? pohon.kiri[node] : pohon.kanan[node];
    depth += 1;
  }
  return depth + cFactor(pohon.n_sampel[node]);
}

export function vektorFiturBerurutan(features: VektorFitur): number[] {
  return DAFTAR_FITUR.map((name: NamaFitur) => Number(features[name]));
}

export function hitungSkorIsolationForest(features: VektorFitur): number {
  const vector = vektorFiturBerurutan(features);
  const averagePath = model.pohon.reduce((sum, tree) => sum + panjangJalur(tree, vector), 0) / model.pohon.length;
  return 2 ** (-averagePath / model.c_max_samples);
}

export function ambilInfoModel() {
  return { versi_model: model.versi_model, ambang: model.ambang };
}

