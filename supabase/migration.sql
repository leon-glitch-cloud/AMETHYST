-- Lucika – Datenbankschema
-- Im Supabase SQL Editor eines neuen Projekts ausführen.
--
-- Zugriff erfolgt ausschließlich server-seitig über den Service-Role-Key
-- (kein Supabase Auth im Einsatz). RLS ist daher aktiviert, aber bewusst
-- ohne Policies: anon/authenticated haben dadurch keinen Zugriff, der
-- Service-Role-Key umgeht RLS.

create extension if not exists "pgcrypto";

-- Perlen / Materialbestand
create table if not exists beads (
  id uuid primary key default gen_random_uuid(),
  article_number text not null unique,
  image_url text,
  size_mm numeric,
  color text,
  unit_price numeric not null default 0,
  source_shop text,
  source_url text,
  stock_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- Armband-Modelle
create table if not exists bracelets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  photo_url text,
  made_count integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

-- Verknüpfung: verwendete Perlen pro Armband-Modell
create table if not exists bracelet_beads (
  id uuid primary key default gen_random_uuid(),
  bracelet_id uuid not null references bracelets (id) on delete cascade,
  bead_id uuid not null references beads (id) on delete restrict,
  quantity integer not null default 1
);

-- Bilanz-Buchungen (Ausgaben, Verkäufe, Rücksendungen)
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  type text not null check (type in ('expense', 'sale', 'refund')),
  description text not null,
  amount numeric not null,
  bracelet_id uuid references bracelets (id) on delete set null,
  counterparty_name text,
  created_at timestamptz not null default now()
);

-- Falls die Tabelle schon vor Einführung von type='refund' angelegt wurde:
-- Constraint auf die aktuelle Wertemenge erweitern (no-op bei frischem Setup).
alter table transactions drop constraint if exists transactions_type_check;
alter table transactions add constraint transactions_type_check
  check (type in ('expense', 'sale', 'refund'));

-- Verkäufe (Geschenke = price 0, Empfänger trotzdem dokumentiert)
create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  bracelet_id uuid not null references bracelets (id) on delete cascade,
  sale_date date not null default current_date,
  buyer_name text not null,
  price numeric not null default 0,
  is_gift boolean not null default false,
  transaction_id uuid references transactions (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Verleihungen (kein Geldfluss, erzeugt keine Buchung)
create table if not exists loans (
  id uuid primary key default gen_random_uuid(),
  bracelet_id uuid not null references bracelets (id) on delete cascade,
  borrower_name text not null,
  loaned_at timestamptz not null default now(),
  returned_at timestamptz,
  created_at timestamptz not null default now()
);

-- Kundenbestellungen (Anfragen, noch kein Verkauf)
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  bracelet_id uuid references bracelets (id) on delete set null,
  wish_text text,
  status text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  sale_id uuid references sales (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint orders_bracelet_or_wish check (
    (bracelet_id is not null and wish_text is null) or
    (bracelet_id is null and wish_text is not null)
  )
);

-- Hochgeladene Bestelllisten (KI-Extraktion, Feature B – spätere Phase)
create table if not exists material_orders (
  id uuid primary key default gen_random_uuid(),
  file_url text not null,
  extracted_json jsonb,
  status text not null default 'pending' check (status in ('pending', 'confirmed')),
  created_at timestamptz not null default now()
);

-- Rücksendung von Perlen (Erstattung) – Kopf + Positionen
create table if not exists bead_returns (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references transactions (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists bead_return_items (
  id uuid primary key default gen_random_uuid(),
  bead_return_id uuid not null references bead_returns (id) on delete cascade,
  bead_id uuid not null references beads (id) on delete restrict,
  quantity integer not null default 1,
  refund_amount numeric not null default 0
);

create index if not exists bracelet_beads_bracelet_id_idx on bracelet_beads (bracelet_id);
create index if not exists bracelet_beads_bead_id_idx on bracelet_beads (bead_id);
create index if not exists sales_bracelet_id_idx on sales (bracelet_id);
create index if not exists loans_bracelet_id_idx on loans (bracelet_id);
create index if not exists transactions_bracelet_id_idx on transactions (bracelet_id);
create index if not exists loans_open_idx on loans (bracelet_id) where returned_at is null;
create index if not exists orders_bracelet_id_idx on orders (bracelet_id);
create index if not exists orders_status_idx on orders (status) where status = 'open';
create index if not exists bead_return_items_bead_return_id_idx on bead_return_items (bead_return_id);
create index if not exists bead_return_items_bead_id_idx on bead_return_items (bead_id);

alter table beads enable row level security;
alter table bracelets enable row level security;
alter table bracelet_beads enable row level security;
alter table transactions enable row level security;
alter table sales enable row level security;
alter table loans enable row level security;
alter table orders enable row level security;
alter table material_orders enable row level security;
alter table bead_returns enable row level security;
alter table bead_return_items enable row level security;

-- Storage-Buckets bitte manuell im Dashboard anlegen (Storage → New bucket,
-- jeweils "Private"): bracelet-photos, bead-photos, material-order-uploads.
-- Siehe SETUP.md.
