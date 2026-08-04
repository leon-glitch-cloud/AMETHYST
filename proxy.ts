import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isValidSessionCookie } from "@/lib/auth/session";

export async function proxy(request: NextRequest) {
  const sessionCookie = request.cookies.get(COOKIE_NAME)?.value;

  if (await isValidSessionCookie(sessionCookie)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
