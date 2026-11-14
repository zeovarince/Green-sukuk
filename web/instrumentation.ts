export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { pastikanKonfigurasiAkses } = await import("./lib/http");
  pastikanKonfigurasiAkses();
}
