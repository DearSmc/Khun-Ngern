-- Phase 1 schema: groups, member registry, bills and shares, webhook idempotency.
-- See docs PRD §4. All money columns are integers in satang.
-- Tables used only by later phases (payments, trips, settlement runs, recurring bills)
-- are added by their own migrations.

-- A LINE group where the bot has been added (F1.1).
create table public.groups (
  group_id          text primary key,             -- LINE group ID
  reminder_time     time not null default '19:00',
  reminders_enabled boolean not null default true,
  bot_left_at       timestamptz,                  -- set on leave; data kept 90 days for re-invite
  created_at        timestamptz not null default now()
);

-- The bot's own member registry per group (F1.5).
create table public.members (
  group_id             text not null references public.groups (group_id) on delete cascade,
  user_id              text not null,             -- LINE user ID
  display_name         text,
  picture_url          text,
  profile_refreshed_at timestamptz,
  joined_at            timestamptz not null default now(),
  left_at              timestamptz,
  primary key (group_id, user_id)
);

create table public.bills (
  bill_id             uuid primary key default gen_random_uuid(),
  group_id            text not null references public.groups (group_id) on delete cascade,
  creator_user_id     text not null,
  owner_user_id       text not null,
  owner_shares        boolean not null default true,
  description         text not null check (char_length(btrim(description)) between 1 and 100),
  total_amount_satang bigint not null check (total_amount_satang > 0),
  split_type          text not null check (split_type in ('even', 'custom')),
  status              text not null default 'open' check (status in ('open', 'settled', 'cancelled')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  cancelled_at        timestamptz,
  check ((status = 'cancelled') = (cancelled_at is not null)),
  unique (bill_id, group_id),
  foreign key (group_id, creator_user_id) references public.members (group_id, user_id),
  foreign key (group_id, owner_user_id) references public.members (group_id, user_id)
);

create index bills_group_status_idx on public.bills (group_id, status);

create table public.bill_shares (
  share_id      uuid primary key default gen_random_uuid(),
  bill_id       uuid not null,
  group_id      text not null,
  user_id       text not null,
  amount_satang bigint not null check (amount_satang >= 0),
  status        text not null default 'unpaid' check (status in ('unpaid', 'paid_self', 'paid')),
  joined_order  integer not null check (joined_order >= 0),
  unique (bill_id, user_id),
  unique (bill_id, joined_order),
  foreign key (bill_id, group_id) references public.bills (bill_id, group_id) on delete cascade,
  foreign key (group_id, user_id) references public.members (group_id, user_id)
);

create index bill_shares_group_user_idx on public.bill_shares (group_id, user_id);

-- Every LINE webhookEventId seen, so redelivered events are ignored (PRD §6 Idempotency).
create table public.processed_webhook_events (
  webhook_event_id text primary key,
  received_at      timestamptz not null default now()
);

-- Only the backend (service role) touches these tables. Row level security with no policies
-- blocks the public API keys from reading or writing anything directly.
alter table public.groups enable row level security;
alter table public.members enable row level security;
alter table public.bills enable row level security;
alter table public.bill_shares enable row level security;
alter table public.processed_webhook_events enable row level security;
