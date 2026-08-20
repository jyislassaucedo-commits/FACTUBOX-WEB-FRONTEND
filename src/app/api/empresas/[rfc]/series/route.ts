import { NextRequest, NextResponse } from "next/server";
import { deleteSerie, editSerie, getSeries, newSerie, type SerieInput } from "@/lib/series";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ rfc: string }> }
) {
  const { rfc } = await params;
  const series = await getSeries(decodeURIComponent(rfc));
  return NextResponse.json({ series });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ rfc: string }> }
) {
  const { rfc } = await params;
  const body = (await request.json().catch(() => null)) as SerieInput | null;

  if (!body?.nombre || !body?.tipo || !body?.inicio) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }

  const resp = await newSerie(decodeURIComponent(rfc), body);
  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ rfc: string }> }
) {
  const { rfc } = await params;
  const body = (await request.json().catch(() => null)) as
    | (SerieInput & { nombreAnterior: string; tipoAnterior: string })
    | null;

  if (!body?.nombre || !body?.tipo || !body?.inicio || !body?.nombreAnterior || !body?.tipoAnterior) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }

  const resp = await editSerie(
    decodeURIComponent(rfc),
    { nombre: body.nombre, tipo: body.tipo, inicio: body.inicio },
    { nombre: body.nombreAnterior, tipo: body.tipoAnterior }
  );
  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ rfc: string }> }
) {
  const { rfc } = await params;
  const body = (await request.json().catch(() => null)) as
    | { nombre: string; tipo: string }
    | null;

  if (!body?.nombre || !body?.tipo) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }

  const resp = await deleteSerie(decodeURIComponent(rfc), body.nombre, body.tipo);
  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
