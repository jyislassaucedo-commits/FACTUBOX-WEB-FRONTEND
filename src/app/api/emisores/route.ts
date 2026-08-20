import { NextResponse } from "next/server";
import { getEmisores } from "@/lib/emisores";

export async function GET() {
  const emisores = await getEmisores();
  return NextResponse.json({ emisores });
}
