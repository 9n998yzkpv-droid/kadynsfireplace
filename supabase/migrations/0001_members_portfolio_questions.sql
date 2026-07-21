-- ============================================================================
-- Kadyn's Fireplace — memberships, portfolio, and member Q&A
--
-- Run this in the Supabase SQL editor (or `supabase db push`) on a fresh
-- project. Everything is idempotent-ish on a clean database; re-running on an
-- existing one will error on CREATE TABLE, which is the safe failure mode.
--
-- Design notes:
--   * Auth identity is Supabase Auth (email OTP today). `members` is the
--     profile table, keyed 1:1 to auth.users. Phone is collected and unique
--     from day one; `phone_verified_at` stays NULL until SMS verification is
--     added later — no migration needed to switch.
--   * `transactions` is the source of truth for the portfolio.  `holdings` is
--     the current-state rollup, updated atomically by apply_transaction() and
--     rebuildable from scratch with rebuild_holdings().
--   * Admin writes NEVER go through RLS policies — they go through Next.js
--     route handlers using the service-role key after the server checks the
--     caller's phone against the ADMIN_PHONES env allowlist. RLS here only
--     defines what anon + logged-in members can do, and it is deliberately
--     narrow.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- members — profile row per auth user
-- ---------------------------------------------------------------------------
create table public.members (
  id                uuid primary key references auth.users (id) on delete cascade,
  name              text not null check (char_length(name) between 1 and 120),
  phone             text not null unique check (phone ~ '^\+[0-9]{8,15}$'), -- E.164
  email             text not null,
  newsletter_opt_in boolean not null default false,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  verified_at       timestamptz,          -- set when the email OTP is confirmed
  phone_verified_at timestamptz           -- reserved for future SMS verification
);

comment on table public.members is
  'Member profiles, 1:1 with auth.users. Created by trigger on signup.';

-- Create the profile row the moment the auth user is created (signInWithOtp
-- with shouldCreateUser creates the user before the code is entered). The
-- unique phone index makes duplicate-phone signups fail atomically: the auth
-- user insert rolls back and the client sees an error.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Users created without member metadata (e.g. a future non-member auth use)
  -- simply don't get a profile row.
  if new.raw_user_meta_data ? 'member_name' then
    insert into public.members (id, name, phone, email, newsletter_opt_in)
    values (
      new.id,
      new.raw_user_meta_data ->> 'member_name',
      new.raw_user_meta_data ->> 'member_phone',
      new.email,
      coalesce((new.raw_user_meta_data ->> 'newsletter_opt_in')::boolean, false)
    );
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Mirror email confirmation into members.verified_at. Gating everywhere uses
-- verified_at, so "verified member" has one definition site-wide.
create or replace function public.handle_user_confirmed()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update public.members set verified_at = new.email_confirmed_at where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_confirmed
  after update on auth.users
  for each row execute function public.handle_user_confirmed();

alter table public.members enable row level security;

create policy "members read own profile"
  on public.members for select
  using (auth.uid() = id);

create policy "members update own name/email prefs"
  on public.members for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- holdings — current-state rollup (public read for the dashboard)
-- ---------------------------------------------------------------------------
create table public.holdings (
  id             uuid primary key default gen_random_uuid(),
  ticker         text not null unique check (ticker ~ '^[A-Z0-9.\-]{1,10}$'),
  shares         numeric(20, 6) not null check (shares > 0),
  avg_cost_basis numeric(20, 4) not null check (avg_cost_basis >= 0),
  updated_at     timestamptz not null default now()
);

alter table public.holdings enable row level security;

-- The portfolio dashboard is public, so holdings are public-read.
-- No insert/update/delete policies: writes only happen via the service role
-- (admin route handlers), which bypasses RLS.
create policy "holdings are public read"
  on public.holdings for select
  using (true);

-- ---------------------------------------------------------------------------
-- transactions — append-only buy/sell log (admin only, source of truth)
-- ---------------------------------------------------------------------------
create table public.transactions (
  id          uuid primary key default gen_random_uuid(),
  ticker      text not null check (ticker ~ '^[A-Z0-9.\-]{1,10}$'),
  type        text not null check (type in ('buy', 'sell')),
  quantity    numeric(20, 6) not null check (quantity > 0),
  price       numeric(20, 4) not null check (price >= 0),
  executed_at date not null,
  note        text check (char_length(note) <= 500),
  created_at  timestamptz not null default now()
);

create index transactions_ticker_idx on public.transactions (ticker, executed_at desc);
create index transactions_executed_idx on public.transactions (executed_at desc);

alter table public.transactions enable row level security;
-- No policies at all: invisible and read-only to anon + members.
-- The service role (admin routes) bypasses RLS.

-- ---------------------------------------------------------------------------
-- apply_transaction — record a buy/sell and update the holdings rollup
-- atomically. Called by the admin API with the service role.
--   buy : weighted-average cost basis
--   sell: shares reduced, basis unchanged; position closes at (near) zero
-- Returns the transaction id.
-- ---------------------------------------------------------------------------
create or replace function public.apply_transaction(
  p_ticker      text,
  p_type        text,
  p_quantity    numeric,
  p_price       numeric,
  p_executed_at date,
  p_note        text default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_tx_id      uuid;
  v_shares     numeric(20, 6);
  v_basis      numeric(20, 4);
  v_new_shares numeric(20, 6);
begin
  if p_type not in ('buy', 'sell') then
    raise exception 'type must be buy or sell';
  end if;
  if p_quantity <= 0 or p_price < 0 then
    raise exception 'quantity must be positive and price non-negative';
  end if;

  -- Serialize concurrent edits to the same ticker.
  select shares, avg_cost_basis into v_shares, v_basis
  from public.holdings where ticker = p_ticker for update;

  if p_type = 'sell' then
    if v_shares is null then
      raise exception 'cannot sell %: no open position', p_ticker;
    end if;
    if p_quantity > v_shares + 0.000001 then
      raise exception 'cannot sell % shares of %: only % held', p_quantity, p_ticker, v_shares;
    end if;
  end if;

  insert into public.transactions (ticker, type, quantity, price, executed_at, note)
  values (upper(p_ticker), p_type, p_quantity, p_price, p_executed_at, nullif(trim(p_note), ''))
  returning id into v_tx_id;

  if p_type = 'buy' then
    if v_shares is null then
      insert into public.holdings (ticker, shares, avg_cost_basis)
      values (upper(p_ticker), p_quantity, p_price);
    else
      update public.holdings
      set shares         = v_shares + p_quantity,
          avg_cost_basis = ((v_shares * v_basis) + (p_quantity * p_price)) / (v_shares + p_quantity),
          updated_at     = now()
      where ticker = p_ticker;
    end if;
  else
    v_new_shares := v_shares - p_quantity;
    if v_new_shares <= 0.000001 then
      delete from public.holdings where ticker = p_ticker;  -- position closed
    else
      update public.holdings
      set shares = v_new_shares, updated_at = now()
      where ticker = p_ticker;
    end if;
  end if;

  return v_tx_id;
end;
$$;

-- Lock the function down: only the service role should ever call it.
revoke execute on function public.apply_transaction from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- rebuild_holdings — recompute the rollup from the full transaction log.
-- Consistency escape hatch: if holdings are ever manually edited or a
-- transaction is deleted, this restores "transactions are the source of truth".
-- ---------------------------------------------------------------------------
create or replace function public.rebuild_holdings()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  t  record;
  tx record;
  v_shares numeric(20, 6);
  v_basis  numeric(20, 4);
begin
  delete from public.holdings;
  for t in
    select distinct ticker from public.transactions
  loop
    v_shares := 0; v_basis := 0;
    for tx in
      select type, quantity, price
      from public.transactions
      where ticker = t.ticker
      order by executed_at, created_at
    loop
      if tx.type = 'buy' then
        v_basis  := case when v_shares + tx.quantity = 0 then 0
                    else ((v_shares * v_basis) + (tx.quantity * tx.price)) / (v_shares + tx.quantity) end;
        v_shares := v_shares + tx.quantity;
      else
        v_shares := v_shares - tx.quantity;
      end if;
    end loop;
    if v_shares > 0.000001 then
      insert into public.holdings (ticker, shares, avg_cost_basis)
      values (t.ticker, v_shares, v_basis);
    end if;
  end loop;
end;
$$;

revoke execute on function public.rebuild_holdings from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- questions — "Be Heard" member Q&A
-- ---------------------------------------------------------------------------
create table public.questions (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members (id) on delete cascade,
  target_type text not null check (target_type in ('holding', 'post', 'topic')),
  target_ref  text not null check (char_length(target_ref) between 1 and 200),
  body        text not null check (char_length(body) between 10 and 2000),
  status      text not null default 'new' check (status in ('new', 'answered', 'hidden')),
  answer      text check (char_length(answer) <= 5000),
  answered_at timestamptz,
  created_at  timestamptz not null default now()
);

create index questions_member_idx on public.questions (member_id, created_at desc);
create index questions_status_idx on public.questions (status, created_at desc);

alter table public.questions enable row level security;

-- Verified, active members can submit questions as themselves.
create policy "verified members submit own questions"
  on public.questions for insert
  with check (
    member_id = auth.uid()
    and exists (
      select 1 from public.members m
      where m.id = auth.uid() and m.verified_at is not null and m.is_active
    )
  );

-- Members see their own questions (and the answers, once given).
create policy "members read own questions"
  on public.questions for select
  using (member_id = auth.uid());

-- No member update/delete; answering + status changes happen through the
-- admin API with the service role.
