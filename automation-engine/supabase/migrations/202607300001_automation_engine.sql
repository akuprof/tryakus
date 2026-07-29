create extension if not exists pgcrypto;

create table if not exists public.automation_jobs (
  id uuid primary key default gen_random_uuid(),
  article_id text not null,
  status text not null check (status in ('planning','planned','rendering','review','publishing','published','failed')),
  input_payload jsonb not null,
  content_plan jsonb,
  publish_targets text[] not null default '{}',
  auto_publish boolean not null default false,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_tasks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.automation_jobs(id) on delete cascade,
  task_type text not null check (task_type in ('render_slide','generate_voiceover','render_reel','publish')),
  task_key text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null check (status in ('queued','processing','blocked','completed','failed')),
  attempt_count integer not null default 0,
  locked_at timestamptz,
  locked_by text,
  output_payload jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(job_id, task_key)
);

create index if not exists automation_jobs_status_idx on public.automation_jobs(status, created_at);
create index if not exists automation_tasks_queue_idx on public.automation_tasks(status, task_type, created_at);

alter table public.automation_jobs enable row level security;
alter table public.automation_tasks enable row level security;
revoke all on public.automation_jobs from anon, authenticated;
revoke all on public.automation_tasks from anon, authenticated;
