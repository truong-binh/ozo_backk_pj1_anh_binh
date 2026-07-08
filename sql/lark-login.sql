-- Đăng nhập web qua bot Lark (không cần email).
-- User nhắn "đăng nhập" cho Feelex QLDA Bot -> bot cấp OTP theo open_id ->
-- nhập OTP trên web -> web biết đúng PIC nào (qua open_id trong login_codes).
-- Chạy 1 lần trên Supabase (SQL editor).

-- login_codes: cho phép mã gắn theo open_id; email trở thành tùy chọn.
alter table public.login_codes add column if not exists open_id text;
alter table public.login_codes alter column email drop not null;
create index if not exists login_codes_open_id_idx on public.login_codes (open_id);

-- app_users: hỗ trợ người chỉ có open_id (đăng ký Lark bằng SĐT, không email).
alter table public.app_users add column if not exists open_id text;
alter table public.app_users alter column email drop not null;
create unique index if not exists app_users_open_id_key
  on public.app_users (open_id) where open_id is not null;
