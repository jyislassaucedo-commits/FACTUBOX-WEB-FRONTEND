import { NextRequest, NextResponse } from "next/server";
import { callPhpApi } from "@/lib/phpApi";
import { setSession } from "@/lib/session";

type LoginPhpResponse = {
  Token: string;
  DeviceId: string;
  ExpiraEnDias: number;
  IdUser: number;
  Rfc: string;
  Email: string;
  Usuario: string;
  Nombre: string;
  Tipo: string;
  EsSubusuario: "SI" | "NO";
};

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const usuario = typeof body?.usuario === "string" ? body.usuario.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!usuario || !password) {
    return NextResponse.json(
      { error: "Usuario y contraseña son obligatorios" },
      { status: 400 }
    );
  }

  const resp = await callPhpApi<LoginPhpResponse>("/endpoint/web/authLoginWeb.php", {
    Usuario: usuario,
    Password: password,
  });

  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 401 });
  }

  await setSession(
    { token: resp.Token, deviceId: resp.DeviceId },
    resp.ExpiraEnDias
  );

  return NextResponse.json({
    user: {
      IdUser: resp.IdUser,
      Rfc: resp.Rfc,
      Email: resp.Email,
      Usuario: resp.Usuario,
      Nombre: resp.Nombre,
      Tipo: resp.Tipo,
      EsSubusuario: resp.EsSubusuario,
    },
  });
}
