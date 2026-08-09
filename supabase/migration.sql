-- Lucica – Datenbankschema
-- Im Supabase SQL Editor eines neuen Projekts ausführen.
--
-- Zugriff erfolgt ausschließlich server-seitig über den Service-Role-Key
-- (kein Supabase Auth im Einsatz). RLS ist daher aktiviert, aber bewusst
-- ohne Policies: anon/authenticated haben dadurch keinen Zugriff, der
-- Service-Role-Key umgeht RLS.

create extension if not exists "pgcrypto";

-- Perlen / Materialbestand (kein Lagerbestand: Preis pro Perle wird aus
-- Packungspreis / Packungsmenge berechnet)
create table if not exists beads (
  id uuid primary key default gen_random_uuid(),
  article_number text not null unique,
  name text,
  material text,
  image_url text,
  size_mm numeric,
  color text,
  package_price numeric not null default 0,
  package_quantity numeric not null default 1 check (package_quantity > 0),
  source_shop text,
  source_url text,
  created_at timestamptz not null default now()
);

-- Armband-Modelle. size + variant_group_id bilden Größen-Varianten (S/M/L)
-- desselben Modells ab: jede Größe ist eine vollständige eigene Zeile (mit
-- eigenem Foto, eigener Perlenliste, eigenem Bestand/Verkäufen), mehrere
-- Zeilen mit derselben variant_group_id gehören zusammen.
create table if not exists bracelets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  photo_url text,
  made_count integer not null default 0,
  notes text,
  size text check (size in ('S', 'M', 'L')),
  variant_group_id uuid,
  created_at timestamptz not null default now()
);

-- Verknüpfung: verwendete Perlen pro Armband-Modell. bead_id ist nullable:
-- eine per KI-Fotoerkennung gefundene, aber noch nicht im Materialbestand
-- erfasste Perle wird als "unbekannt" mit Beschreibung angelegt und später
-- manuell einer echten Perle zugeordnet.
create table if not exists bracelet_beads (
  id uuid primary key default gen_random_uuid(),
  bracelet_id uuid not null references bracelets (id) on delete cascade,
  bead_id uuid references beads (id) on delete restrict,
  quantity integer not null default 1,
  unknown_description text,
  constraint bracelet_beads_bead_or_unknown
    check (bead_id is not null or unknown_description is not null)
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
  notes text,
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

-- Falls orders schon existiert: notes ergänzen (no-op bei frischem Setup).
alter table orders add column if not exists notes text;

-- Falls beads schon existiert: name + material ergänzen (no-op bei frischem Setup).
alter table beads add column if not exists name text;
alter table beads add column if not exists material text;

-- Falls bracelet_beads schon mit bead_id not null existiert: nullable machen
-- + unknown_description ergänzen, für unbekannte Perlen aus der Fotoerkennung
-- (no-op bei frischem Setup).
alter table bracelet_beads alter column bead_id drop not null;
alter table bracelet_beads add column if not exists unknown_description text;
alter table bracelet_beads drop constraint if exists bracelet_beads_bead_or_unknown;
alter table bracelet_beads add constraint bracelet_beads_bead_or_unknown
  check (bead_id is not null or unknown_description is not null);

-- Falls beads schon mit altem Preismodell (unit_price/stock_count) angelegt
-- wurde: auf Packungspreis/-menge umstellen (no-op bei frischem Setup).
alter table beads add column if not exists package_price numeric not null default 0;
alter table beads add column if not exists package_quantity numeric not null default 1;
alter table beads drop constraint if exists beads_package_quantity_check;
alter table beads add constraint beads_package_quantity_check check (package_quantity > 0);
alter table beads drop column if exists unit_price;
alter table beads drop column if exists stock_count;
-- Preis pro Perle wird automatisch berechnet, nicht manuell gepflegt.
alter table beads add column if not exists unit_price numeric
  generated always as (package_price / package_quantity) stored;

-- Rücksende-Feature mit Bestandsabzug entfernt – Rücksendungen laufen künftig
-- nur noch als normale positive Buchung über transactions (no-op bei frischem Setup).
drop table if exists bead_return_items;
drop table if exists bead_returns;

-- Falls bracelets schon existiert: Größen-Varianten (S/M/L) ergänzen
-- (no-op bei frischem Setup).
alter table bracelets add column if not exists size text;
alter table bracelets drop constraint if exists bracelets_size_check;
alter table bracelets add constraint bracelets_size_check check (size in ('S', 'M', 'L'));
alter table bracelets add column if not exists variant_group_id uuid;

create index if not exists bracelet_beads_bracelet_id_idx on bracelet_beads (bracelet_id);
create index if not exists bracelet_beads_bead_id_idx on bracelet_beads (bead_id);
create index if not exists bracelets_variant_group_id_idx on bracelets (variant_group_id);
create index if not exists sales_bracelet_id_idx on sales (bracelet_id);
create index if not exists loans_bracelet_id_idx on loans (bracelet_id);
create index if not exists transactions_bracelet_id_idx on transactions (bracelet_id);
create index if not exists loans_open_idx on loans (bracelet_id) where returned_at is null;
create index if not exists orders_bracelet_id_idx on orders (bracelet_id);
create index if not exists orders_status_idx on orders (status) where status = 'open';

alter table beads enable row level security;
alter table bracelets enable row level security;
alter table bracelet_beads enable row level security;
alter table transactions enable row level security;
alter table sales enable row level security;
alter table loans enable row level security;
alter table orders enable row level security;
alter table material_orders enable row level security;

-- Storage-Buckets bitte manuell im Dashboard anlegen (Storage → New bucket):
-- bracelet-photos (Public), bead-photos (Public), material-order-uploads
-- (Private). Siehe SETUP.md.
