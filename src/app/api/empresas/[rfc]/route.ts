import { NextRequest, NextResponse } from "next/server";
import { getEmisor } from "@/lib/emisores";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ rfc: string }> }
) {
  const { rfc } = await params;
  const emisor = await getEmisor(decodeURIComponent(rfc));

  if (!emisor) {
    return NextResponse.json({ error: "Emisor no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ emisor });
}
