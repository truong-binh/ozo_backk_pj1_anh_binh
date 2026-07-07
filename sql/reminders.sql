-- Bảng chống gửi trùng nhắc việc. Chạy 1 lần trong Supabase SQL Editor.
create table if not exists public.sent_reminders (
  id         bigint generated always as identity primary key,
  project_id bigint not null,
  node_id    text   not null,
  kind       text   not null,   -- 'assigned' | 'due_soon' | 'overdue'
  dedup_key  text   not null,   -- assigned: tên PIC | due_soon: hạn ISO | overdue: ngày hôm nay ISO
  pic        text,
  email      text,
  sent_at    timestamptz not null default now(),
  unique (project_id, node_id, kind, dedup_key)
);

create index if not exists sent_reminders_lookup
  on public.sent_reminders (project_id, node_id, kind);
