-- Thêm trường Phòng ban cho PIC. Chạy 1 lần trong Supabase SQL Editor.
alter table public.pic_members add column if not exists dept text;

-- Điền phòng ban cho từng PIC. Dùng đúng mã phòng như danh sách của app:
--   BGĐ, NCC, PC, PC-DV, PP, RD, Sale, TK
-- Ví dụ (sửa theo thực tế):
-- update public.pic_members set dept = 'RD'  where pic_name = 'Cao Huy Bình';
-- update public.pic_members set dept = 'RD'  where pic_name = 'Phạm Khánh Ly';
-- update public.pic_members set dept = 'RD'  where pic_name = 'Lê Thị Kim Tuyến';
-- update public.pic_members set dept = 'TK'  where pic_name = 'Vũ Thị Bích Hồng';
-- update public.pic_members set dept = 'PP'  where pic_name = 'Vũ Thị Lan';
