-- Bảng người dùng + mã đăng nhập (OTP) cho luồng passwordless qua Lark.
-- Chạy trong Supabase SQL Editor. An toàn khi chạy lại (IF NOT EXISTS).

create table if not exists public.app_users (
  id           bigint generated always as identity primary key,
  email        text not null unique,
  name         text,
  role         text not null default 'employee',   -- 'PIC' | 'employee'
  created_at   timestamptz not null default now(),
  last_login_at timestamptz
);

-- Mã OTP dùng 1 lần, gửi qua Lark bot.
create table if not exists public.login_codes (
  id          bigint generated always as identity primary key,
  email       text not null,
  code_hash   text not null,
  expires_at  timestamptz not null,
  consumed    boolean not null default false,
  attempts    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists login_codes_email_idx on public.login_codes (email);
create index if not exists login_codes_expires_idx on public.login_codes (expires_at);

-- Danh sách PIC: map email công ty -> tên PIC (đúng như tên hiển thị ở cột "PIC").
-- Đăng nhập bằng email trong bảng này -> vai trò PIC, chỉ sửa được dòng có pic = pic_name.
-- Email không có trong bảng -> vai trò "viewer" (chỉ xem).
create table if not exists public.pic_members (
  email      text primary key,
  pic_name   text not null,
  created_at timestamptz not null default now()
);

-- Ví dụ thêm PIC (email phải viết thường, pic_name phải KHỚP CHÍNH XÁC tên ở cột PIC):
-- insert into public.pic_members (email, pic_name) values
--   ('binh@ozovn.com', 'Cao Huy Bình'),
--   ('ly@ozovn.com',   'Phạm Khánh Ly')
-- on conflict (email) do update set pic_name = excluded.pic_name;
