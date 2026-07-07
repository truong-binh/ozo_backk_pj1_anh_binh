-- Migration: định danh PIC theo open_id (Lark) thay vì phụ thuộc email.
-- Lý do: người đăng ký Lark bằng SĐT / ẩn email -> Lark không trả email ->
-- trước đây không vào được danh bạ, không nhận DM, không dùng được chatbot.
-- open_id thì LUÔN lấy được (event sender / list thành viên) nên bám vào nó.
--
-- Thiết kế: PK đổi sang cột surrogate `id` (an toàn, không kẹt thứ tự backfill);
-- `open_id` UNIQUE là định danh thật; `email` cho phép rỗng, UNIQUE khi có giá trị.
-- UNIQUE chuẩn của Postgres coi các NULL là khác nhau -> nhiều dòng email/open_id
-- rỗng vẫn hợp lệ, đồng thời dùng được làm đích ON CONFLICT khi upsert.
--
-- Chạy 1 lần trên Supabase SQL editor. Sau đó chạy script backfill open_id:
--   node scripts/backfill-open-id.js

ALTER TABLE public.pic_members ADD COLUMN IF NOT EXISTS open_id text;
ALTER TABLE public.pic_members ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.pic_members ADD COLUMN IF NOT EXISTS id bigint GENERATED ALWAYS AS IDENTITY;

-- Bỏ PK cũ (email) -> đặt PK mới là id.
ALTER TABLE public.pic_members DROP CONSTRAINT IF EXISTS pic_members_pkey;
ALTER TABLE public.pic_members ADD PRIMARY KEY (id);

-- email không còn bắt buộc.
ALTER TABLE public.pic_members ALTER COLUMN email DROP NOT NULL;

-- Định danh & chống trùng. NULL được coi là khác nhau nên rỗng vẫn OK.
ALTER TABLE public.pic_members DROP CONSTRAINT IF EXISTS pic_members_open_id_key;
ALTER TABLE public.pic_members ADD CONSTRAINT pic_members_open_id_key UNIQUE (open_id);
ALTER TABLE public.pic_members DROP CONSTRAINT IF EXISTS pic_members_email_key;
ALTER TABLE public.pic_members ADD CONSTRAINT pic_members_email_key UNIQUE (email);
