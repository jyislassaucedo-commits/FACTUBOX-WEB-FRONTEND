import { NextResponse } from "next/server";
import { callPhpApi } from "@/lib/phpApi";
import { clearSession, getSession } from "@/lib/session";

export async function POST() {
  const session = await getSession();

  if (session) {
    await callPhpApi("/endpoint/web/authLogoutWeb.php", {
      SessionToken: session.token,
      DeviceId: session.deviceId,
    });
  }

  await clearSession();
  return NextResponse.json({ ok: true });
}
