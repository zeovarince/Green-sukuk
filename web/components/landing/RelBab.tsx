const BAB = [
  { id: "bab-0", label: "Pembuka" },
  { id: "bab-1", label: "Dua kurva" },
  { id: "bab-2", label: "Transaksi" },
  { id: "bab-3", label: "Aturan dan skor" },
  { id: "bab-4", label: "Rantai" },
  { id: "bab-5", label: "Hasil" },
  { id: "bab-6", label: "Coba sendiri" },
];

export default function RelBab({ active }: { active: number }) {
  return (
    <nav className="landing-rail" aria-label="Bab landing GSTP">
      {BAB.map((chapter, index) => (
        <a
          key={chapter.id}
          href={`#${chapter.id}`}
          aria-label={`Bab ${index + 1}: ${chapter.label}`}
          aria-current={active === index ? "step" : undefined}
          title={chapter.label}
        >
          <span>{String(index + 1).padStart(2, "0")}</span>
        </a>
      ))}
    </nav>
  );
}
