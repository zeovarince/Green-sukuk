import { json } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  return json({ enabled: process.env.DEMO_MODE === "true" });
}
