-- Thêm trường Phòng ban + Trưởng phòng cho PIC. Chạy 1 lần trong Supabase SQL Editor.
alter table public.pic_members add column if not exists dept text;                          -- phòng chính
alter table public.pic_members add column if not exists is_leader boolean not null default false;
alter table public.pic_members add column if not exists lead_depts text[] not null default '{}'; -- các phòng làm trưởng phòng (hỗ trợ nhiều phòng)

-- Đặt trưởng phòng bằng lead_depts (1 người có thể quản nhiều phòng; 1 phòng có thể nhiều leader). Ví dụ:
-- update public.pic_members set lead_depts = array['RD']       where email = 'binhozovn@gmail.com';
-- update public.pic_members set lead_depts = array['BGĐ','PC'] where email = 'thang514880@gmail.com'; -- Giám đốc quản nhiều phòng

-- Điền phòng ban cho từng PIC. Dùng đúng mã phòng như danh sách của app:
--   BGĐ, NCC, PC, PC-DV, PP, RD, Sale, TK
-- Ví dụ (sửa theo thực tế):
-- update public.pic_members set dept = 'RD'  where pic_name = 'Cao Huy Bình';
-- update public.pic_members set dept = 'RD'  where pic_name = 'Phạm Khánh Ly';
-- update public.pic_members set dept = 'RD'  where pic_name = 'Lê Thị Kim Tuyến';
-- update public.pic_members set dept = 'TK'  where pic_name = 'Vũ Thị Bích Hồng';
-- update public.pic_members set dept = 'PP'  where pic_name = 'Vũ Thị Lan';
