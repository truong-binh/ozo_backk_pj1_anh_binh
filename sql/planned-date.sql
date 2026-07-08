-- Mốc NGÀY DỰ KIẾN cố định (baseline) chốt khi tạo dự án — không trôi theo tiến độ.
-- Khác với "due" động tính bằng computeAllDates (đổi theo duration/ngày thực tế).
-- Chạy 1 lần trên Supabase, rồi chạy scripts/backfill-planned.js để điền dự án cũ.
alter table public.project_nodes add column if not exists planned_date date;
