# Setup

## 1. Supabase-Projekt anlegen

1. Neues Projekt auf https://supabase.com anlegen.
2. Im SQL Editor den Inhalt von `supabase/migration.sql` ausführen.
3. Unter Storage drei **private** Buckets anlegen:
   - `bracelet-photos`
   - `bead-photos`
   - `material-order-uploads`
4. Unter Project Settings → API: `Project URL` und den `service_role`-Key
   kopieren (service_role, **nicht** anon/public – wird nur server-seitig
   verwendet und nie an den Browser geschickt).

## 2. Umgebungsvariablen

`.env.local.example` nach `.env.local` kopieren und ausfüllen:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_PASSWORD` – gemeinsames Passwort für den Zugriffsschutz
- `APP_SESSION_SECRET` – langer Zufallsstring, z. B. mit `openssl rand -hex 32`

## 3. Lokal starten

```
npm install
npm run dev
```

`http://localhost:3000` öffnen → Passwort-Seite → nach Login erscheint das
Saldo-Dashboard.

## 4. Deployment (Vercel)

Repo mit Vercel verbinden und dieselben vier Umgebungsvariablen im
Vercel-Projekt unter Settings → Environment Variables setzen.
