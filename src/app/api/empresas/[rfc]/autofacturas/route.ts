import { NextRequest, NextResponse } from "next/server";
import { getAutofacturas } from "@/lib/autofacturasEmisor";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ rfc: string }> }
) {
  const { rfc } = await params;
  const autofacturas = await getAutofacturas(decodeURIComponent(rfc));
  return NextResponse.json({ autofacturas });
}
