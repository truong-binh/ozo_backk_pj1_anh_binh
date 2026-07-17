-- Chuyển project_nodes.pic từ text (1 PIC) sang text[] (nhiều PIC/1 bước).
-- Tất cả PIC của 1 bước phải CÙNG PHÒNG (ràng buộc ở tầng ứng dụng, không ở DB).
-- Chạy 1 lần trên Supabase (SQL Editor). An toàn với dữ liệu cũ:
--   - NULL / '' -> mảng rỗng {}
--   - "Nguyễn Văn A" -> {"Nguyễn Văn A"}

ALTER TABLE public.project_nodes
  ALTER COLUMN pic DROP DEFAULT;

ALTER TABLE public.project_nodes
  ALTER COLUMN pic TYPE text[]
  USING (
    CASE
      WHEN pic IS NULL OR btrim(pic) = '' THEN '{}'::text[]
      ELSE ARRAY[pic]
    END
  );

ALTER TABLE public.project_nodes
  ALTER COLUMN pic SET DEFAULT '{}'::text[];
