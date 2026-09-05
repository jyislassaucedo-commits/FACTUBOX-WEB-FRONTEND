import { NextRequest, NextResponse } from "next/server";
import { getRegistroPatronal, saveRegistroPatronal } from "@/lib/empleados";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ rfc: string }> }
) {
  const { rfc } = await params;
  const registroPatronal = await getRegistroPatronal(decodeURIComponent(rfc));
  return NextResponse.json({ registroPatronal });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ rfc: string }> }
) {
  const { rfc } = await params;
  const body = (await request.json().catch(() => null)) as { registroPatronal?: string } | null;

  if (body === null || typeof body.registroPatronal !== "string") {
    return NextResponse.json({ error: "Falta el registro patronal" }, { status: 400 });
  }

  const resp = await saveRegistroPatronal(decodeURIComponent(rfc), body.registroPatronal.trim());
  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  }
  return NextResponse.json({ ok: true, registroPatronal: resp.RegistroPatronal });
}
