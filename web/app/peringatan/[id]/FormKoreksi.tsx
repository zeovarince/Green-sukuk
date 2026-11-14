"use client";

import { useState } from "react";
import { api, formatRupiah } from "@/lib/format";
import rules from "@/data/artifacts/rules_config.json";

export type TransaksiKoreksi = {
  trx_id: string;
  project_id: string;
  tanggal: string;
  jenis_pembayaran: string;
  nilai_pencairan: number;
  progres_fisik_pct: number;
  milestone_terverifikasi: boolean;
  persetujuan_diperoleh: number;
  kelengkapan_bukti: number;
  kategori_hijau: string;
  hash_tercatat: string;
  hash_dokumen_saat_ini: string;
};

export type HasilKoreksi = {
  trx_id_baru: string;
  hasil: {
    keputusan: "normal" | "peringatan";
    jenis_peringatan: string | null;
    temuan_aturan: { kode: string; pesan: string; prinsip: string }[];
    skor: { nilai: number | null; ambang: number; di_atas_ambang: boolean; versi_model: string };
  };
  peringatan_lama: { id: string; status: string };
  peringatan_baru: { id: string } | null;
  seq_ledger: number[];
};

type Props = {
  peringatanId: string;
  trx: TransaksiKoreksi;
  passcode: string;
  onDone: (result: HasilKoreksi) => void;
};

type Form = {
  project_id: string;
  tanggal: string;
  jenis_pembayaran: string;
  nilai_pencairan: string;
  progres_fisik_pct: string;
  milestone_terverifikasi: boolean;
  persetujuan_diperoleh: string;
  kelengkapan_bukti: string;
  kategori_hijau: string;
  hash_tercatat: string;
  hash_dokumen_saat_ini: string;
  alasan: string;
  diajukan_oleh: string;
};

function nilaiAwal(trx: TransaksiKoreksi): Form {
  return {
    project_id: trx.project_id,
    tanggal: String(trx.tanggal).slice(0, 10),
    jenis_pembayaran: trx.jenis_pembayaran,
    nilai_pencairan: String(trx.nilai_pencairan),
    progres_fisik_pct: String(trx.progres_fisik_pct),
    milestone_terverifikasi: Boolean(trx.milestone_terverifikasi),
    persetujuan_diperoleh: String(trx.persetujuan_diperoleh),
    kelengkapan_bukti: String(trx.kelengkapan_bukti),
    kategori_hijau: trx.kategori_hijau,
    hash_tercatat: String(trx.hash_tercatat ?? ""),
    hash_dokumen_saat_ini: String(trx.hash_dokumen_saat_ini ?? ""),
    alasan: "",
    diajukan_oleh: "",
  };
}

export default function FormKoreksi({ peringatanId, trx, passcode, onDone }: Props) {
  const [form, setForm] = useState<Form>(() => nilaiAwal(trx));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  function ubah<K extends keyof Form>(name: K, value: Form[K]) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function perubahan() {
    const result: Record<string, unknown> = {};
    if (form.project_id !== trx.project_id) result.project_id = form.project_id.trim();
    if (form.tanggal !== String(trx.tanggal).slice(0, 10)) result.tanggal = form.tanggal;
    if (form.jenis_pembayaran !== trx.jenis_pembayaran) result.jenis_pembayaran = form.jenis_pembayaran;
    if (Number(form.nilai_pencairan) !== Number(trx.nilai_pencairan)) result.nilai_pencairan = Number(form.nilai_pencairan);
    if (Number(form.progres_fisik_pct) !== Number(trx.progres_fisik_pct)) result.progres_fisik_pct = Number(form.progres_fisik_pct);
    if (form.milestone_terverifikasi !== Boolean(trx.milestone_terverifikasi)) result.milestone_terverifikasi = form.milestone_terverifikasi;
    if (Number(form.persetujuan_diperoleh) !== Number(trx.persetujuan_diperoleh)) result.persetujuan_diperoleh = Number(form.persetujuan_diperoleh);
    if (Number(form.kelengkapan_bukti) !== Number(trx.kelengkapan_bukti)) result.kelengkapan_bukti = Number(form.kelengkapan_bukti);
    if (form.kategori_hijau !== trx.kategori_hijau) result.kategori_hijau = form.kategori_hijau;
    if (form.hash_tercatat !== String(trx.hash_tercatat ?? "")) result.hash_tercatat = form.hash_tercatat;
    if (form.hash_dokumen_saat_ini !== String(trx.hash_dokumen_saat_ini ?? "")) result.hash_dokumen_saat_ini = form.hash_dokumen_saat_ini;
    return result;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!passcode) { setError("Terapkan kode akses penyedia data terlebih dahulu."); return; }
    if (form.alasan.trim().length < 8) { setError("Alasan koreksi wajib diisi minimal 8 karakter."); return; }
    if (form.diajukan_oleh.trim().length < 3) { setError("Nama atau jabatan pengaju wajib diisi minimal 3 karakter."); return; }
    const isiPerubahan = perubahan();
    if (Object.keys(isiPerubahan).length === 0) { setError("Ubah sedikitnya satu nilai sebelum mengirim koreksi."); return; }
    setPending(true);
    try {
      const result = await api<HasilKoreksi>(`/api/peringatan/${encodeURIComponent(peringatanId)}/koreksi`, {
        method: "POST",
        headers: { "x-kode-akses": passcode },
        body: JSON.stringify({
          alasan: form.alasan.trim(),
          diajukan_oleh: form.diajukan_oleh.trim(),
          perubahan: isiPerubahan,
        }),
      });
      onDone(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Koreksi belum dapat dikirim. Periksa nilai dan coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="correction-form" onSubmit={submit}>
      <p className="provenance">Transaksi lama tidak dihapus. Server membuat transaksi baru, memeriksanya ulang, lalu menautkan keduanya di ledger.</p>
      <div className="form-grid">
        <div className="field"><label htmlFor="koreksi-project">ID proyek</label><input id="koreksi-project" value={form.project_id} maxLength={128} onChange={(event) => ubah("project_id", event.target.value)} required /></div>
        <div className="field"><label htmlFor="koreksi-tanggal">Tanggal</label><input id="koreksi-tanggal" type="date" value={form.tanggal} onChange={(event) => ubah("tanggal", event.target.value)} required /></div>
        <div className="field"><label htmlFor="koreksi-jenis">Jenis pembayaran</label><select id="koreksi-jenis" value={form.jenis_pembayaran} onChange={(event) => ubah("jenis_pembayaran", event.target.value)}><option value="uang_muka">Uang muka</option><option value="termin">Termin</option><option value="retensi">Retensi</option></select></div>
        <div className="field"><label htmlFor="koreksi-nilai">Nilai pencairan</label><div className="field-prefix"><span>Rp</span><input id="koreksi-nilai" type="number" min="1" step="1" value={form.nilai_pencairan} onChange={(event) => ubah("nilai_pencairan", event.target.value)} required /></div><span className="field-help">Nilai lama {formatRupiah(trx.nilai_pencairan)}</span></div>
        <div className="field"><label htmlFor="koreksi-progres">Progres fisik</label><input id="koreksi-progres" type="number" min="0" max="100" step="0.01" value={form.progres_fisik_pct} onChange={(event) => ubah("progres_fisik_pct", event.target.value)} required /></div>
        <div className="field"><label htmlFor="koreksi-persetujuan">Persetujuan diperoleh</label><input id="koreksi-persetujuan" type="number" min="0" max="100" step="1" value={form.persetujuan_diperoleh} onChange={(event) => ubah("persetujuan_diperoleh", event.target.value)} required /></div>
        <div className="field"><label htmlFor="koreksi-bukti">Kelengkapan bukti</label><input id="koreksi-bukti" type="number" min="0" max="1" step="0.01" value={form.kelengkapan_bukti} onChange={(event) => ubah("kelengkapan_bukti", event.target.value)} required /></div>
        <div className="field"><label htmlFor="koreksi-kategori">Kategori hijau</label><select id="koreksi-kategori" value={form.kategori_hijau} onChange={(event) => ubah("kategori_hijau", event.target.value)}>{rules.kategori_sah.map((category) => <option key={category}>{category}</option>)}{!(rules.kategori_sah as readonly string[]).includes(form.kategori_hijau) && <option value={form.kategori_hijau}>{form.kategori_hijau}</option>}</select></div>
        <div className="field field-wide"><label><input type="checkbox" checked={form.milestone_terverifikasi} onChange={(event) => ubah("milestone_terverifikasi", event.target.checked)} /> Milestone terverifikasi</label></div>
        <details className="field field-wide"><summary>Opsi hash dokumen</summary><div className="form-grid" style={{ marginTop: 12 }}><div className="field"><label htmlFor="koreksi-hash-lama">Hash tercatat</label><input id="koreksi-hash-lama" value={form.hash_tercatat} onChange={(event) => ubah("hash_tercatat", event.target.value)} /></div><div className="field"><label htmlFor="koreksi-hash-baru">Hash dokumen saat ini</label><input id="koreksi-hash-baru" value={form.hash_dokumen_saat_ini} onChange={(event) => ubah("hash_dokumen_saat_ini", event.target.value)} /></div></div></details>
        <div className="field field-wide"><label htmlFor="koreksi-alasan">Alasan koreksi</label><textarea id="koreksi-alasan" value={form.alasan} maxLength={2000} onChange={(event) => ubah("alasan", event.target.value)} placeholder="Contoh: progres fisik salah ketik pada laporan bulan ini." required /></div>
        <div className="field field-wide"><label htmlFor="koreksi-pengaju">Diajukan oleh</label><input id="koreksi-pengaju" value={form.diajukan_oleh} maxLength={80} onChange={(event) => ubah("diajukan_oleh", event.target.value)} placeholder="Nama atau jabatan pengusul" required /></div>
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="button-row" style={{ marginTop: 14 }}><button className="button button-primary" type="submit" disabled={pending}>{pending ? "Mengirim koreksi" : "Kirim koreksi"}</button><button className="button" type="button" disabled={pending} onClick={() => setForm(nilaiAwal(trx))}>Kembalikan nilai lama</button></div>
    </form>
  );
}
