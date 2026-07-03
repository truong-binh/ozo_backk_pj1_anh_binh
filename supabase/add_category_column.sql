-- Thêm cột "category" (Phân loại ngành hàng) vào bảng projects nếu chưa có.
-- Chạy trong Supabase SQL Editor. An toàn khi chạy nhiều lần (IF NOT EXISTS).

alter table public.projects
  add column if not exists category text;

-- (Tuỳ chọn) Backfill nhanh theo dữ liệu hiện có, ví dụ suy ra từ type/tên.
-- Bỏ comment nếu muốn dùng:
-- update public.projects set category = 'Chăm sóc sức khỏe' where category is null;
