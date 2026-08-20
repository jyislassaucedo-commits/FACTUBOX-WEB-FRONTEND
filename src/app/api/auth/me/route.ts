import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/currentUser";
import { clearSession } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    await clearSession();
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({ user });
}
