export const ANGGOTA_TIM = [
  { nama: "M. Hendrik Purwanto", foto: "/tim/hendrik.jpeg", peran: "Tim GSTP" },
  { nama: "Nana Adelia Saputri", foto: "/tim/nana.jpeg", peran: "Tim GSTP" },
  { nama: "A. Choiril Anwar EL-Asfihani Risydan", foto: "/tim/choiril.jpeg", peran: "Tim GSTP" },
] as const;

if (ANGGOTA_TIM.some((anggota) => anggota.nama.toLocaleUpperCase("id-ID").includes("NAMA ANGGOTA"))) {
  throw new Error("Isi nama anggota tim di web/lib/tim.ts sebelum membangun situs.");
}
