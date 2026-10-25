import metrics from "@/data/artifacts/hasil_evaluasi.json";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(metrics, { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } });
}

