import { describe, expect, it } from "vitest";
import golden from "@/data/artifacts/golden_cases.json";
import { hitungFiturSatuTransaksi } from "@/lib/fitur";
import { periksaAturanTransaksi } from "@/lib/aturan";
import { hitungSkorIsolationForest } from "@/lib/iforest";
import { kanonikalisasiPayload, hitungHashEntriLedger, verifikasiRantaiLedger } from "@/lib/ledger";

describe("kesesuaian Python dan TypeScript", () => {
  it.each(golden.kasus.map((item) => [item.id, item] as const))("fitur, aturan, dan skor cocok untuk %s", (_id, item) => {
    const features = hitungFiturSatuTransaksi(
      item.masukan,
      item.riwayat,
      item.konteks.pagu_alokasi_kontrak,
      item.konteks.nilai_kontrak,
      item.konteks.tanggal_mulai_kontrak,
    );
    for (const [name, expected] of Object.entries(item.jawaban.fitur)) {
      const actual = features[name as keyof typeof features];
      expect(Math.abs(actual - expected), `${item.id}: fitur ${name}`).toBeLessThanOrEqual(1e-9 * Math.max(1, Math.abs(expected)));
    }

    const findings = periksaAturanTransaksi(item.masukan, {
      projectIdSah: item.konteks.project_id_sah,
      projectIdKontrak: item.konteks.project_id_kontrak,
      paguAlokasiKontrak: item.konteks.pagu_alokasi_kontrak,
      kumulatifCairSebelumnya: item.konteks.kumulatif_cair_sebelumnya,
    });
    expect(findings.map((finding) => finding.kode).sort()).toEqual([...item.jawaban.aturan].sort());
    expect(hitungSkorIsolationForest(features), `${item.id}: skor`).toBeCloseTo(item.jawaban.skor, 9);
  });

  it.each(golden.ledger_kanonik_cases.map((item, index) => [`payload ${index + 1}`, item] as const))("kanonikalisasi dan hash ledger cocok untuk %s", (_name, item) => {
    const canonical = kanonikalisasiPayload(item.payload);
    expect(canonical).toBe(item.payload_kanonik_expected);
    expect(hitungHashEntriLedger(item.hash_sebelumnya, canonical)).toEqual({
      hash_payload: item.hash_payload_expected,
      hash_saat_ini: item.hash_saat_ini_expected,
    });
  });

  it("mendeteksi perubahan ledger tepat pada seq yang diubah", () => {
    const first = golden.ledger_kanonik_cases[0];
    const second = golden.ledger_kanonik_cases[1];
    const entries = [
      { seq: 1, payload_kanonik: first.payload_kanonik_expected, hash_payload: first.hash_payload_expected, hash_sebelumnya: first.hash_sebelumnya, hash_saat_ini: first.hash_saat_ini_expected },
      { seq: 2, payload_kanonik: second.payload_kanonik_expected, hash_payload: second.hash_payload_expected, hash_sebelumnya: second.hash_sebelumnya, hash_saat_ini: second.hash_saat_ini_expected },
    ];
    expect(verifikasiRantaiLedger(entries).valid).toBe(true);
    entries[0].payload_kanonik += " ";
    const damaged = verifikasiRantaiLedger(entries);
    expect(damaged.valid).toBe(false);
    expect(damaged.rusak_pada).toBe(1);
  });
});

