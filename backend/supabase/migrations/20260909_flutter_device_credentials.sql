-- Flutter device-token compatibility for the AirIndia Android client.
-- Run this once in Supabase SQL Editor before deploying the updated API.

create extension if not exists pgcrypto;

create table if not exists public.mobile_device_credentials (
  id uuid primary key default gen_random_uuid(),
  installation_id uuid not null unique,
  device_id uuid not null unique references public.devices(id) on delete cascade,
  device_user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique check (char_length(token_hash) = 64),
  security_code_salt text not null,
  security_code_hash text not null,
  username varchar(6) not null check (username ~ '^[A-Za-z0-9]{6}$'),
  mobile varchar(24) not null,
  app_version varchar(40),
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists mobile_device_credentials_device_user_idx
  on public.mobile_device_credentials(device_user_id);

alter table public.mobile_device_credentials enable row level security;

-- No anon/authenticated policies are created. Only the server-side Supabase
-- secret/service-role client may read token hashes or security-code digests.
revoke all on table public.mobile_device_credentials from anon, authenticated;
