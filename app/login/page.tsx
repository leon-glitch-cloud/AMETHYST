import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  COOKIE_NAME,
  SESSION_DURATION_MS,
  createSessionCookieValue,
} from "@/lib/auth/session";

async function login(formData: FormData) {
  "use server";

  const password = formData.get("password");
  if (typeof password !== "string" || password !== process.env.APP_PASSWORD) {
    redirect("/login?error=1");
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, await createSessionCookieValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  });

  redirect("/");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-center text-xl font-medium text-gray-900">
          Lucika
        </h1>
        <form action={login} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm text-gray-600"
            >
              Passwort
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoFocus
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-gray-500"
            />
          </div>
          {error === "1" && (
            <p className="text-sm text-gray-500">Falsches Passwort.</p>
          )}
          <button
            type="submit"
            className="w-full rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            Anmelden
          </button>
        </form>
      </div>
    </main>
  );
}
