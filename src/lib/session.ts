import { cookies } from "next/headers";

const SESSION_COOKIE = "factubox_session";

export type SessionData = {
  token: string;
  deviceId: string;
};

export async function getSession(): Promise<SessionData | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.token === "string" && typeof parsed.deviceId === "string") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function setSession(data: SessionData, expiraEnDias: number) {
  const store = await cookies();
  store.set(SESSION_COOKIE, JSON.stringify(data), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: expiraEnDias * 24 * 60 * 60,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
