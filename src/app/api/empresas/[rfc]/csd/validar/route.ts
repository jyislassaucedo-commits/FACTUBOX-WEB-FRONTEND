import { NextRequest, NextResponse } from "next/server";
import { validarCsd } from "@/lib/emisores";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const pass = formData.get("pass");
  const csd = formData.get("csd");
  const key = formData.get("key");

  if (typeof pass !== "string" || !(csd instanceof File) || !(key instanceof File)) {
    return NextResponse.json({ error: "Faltan archivos o datos" }, { status: 400 });
  }

  const resp = await validarCsd(csd, key, pass);

  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  }

  return NextResponse.json(resp);
}
