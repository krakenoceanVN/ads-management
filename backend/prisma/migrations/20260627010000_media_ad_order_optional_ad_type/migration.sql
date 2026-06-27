-- MediaAdOrder: bỏ liên kết bắt buộc với AdType.
-- adTypeId: NOT NULL → nullable; unique (downstreamId, adTypeId, seq) → (downstreamId, seq).
-- seq nay danh theo downstream (khong con theo cap downstream+adType).

-- 1. Drop old composite unique (scoped by adTypeId)
DROP INDEX IF EXISTS "MediaAdOrder_downstreamId_adTypeId_seq_key";

-- 2. adTypeId thanh nullable
ALTER TABLE "MediaAdOrder" ALTER COLUMN "adTypeId" DROP NOT NULL;

-- 3. Re-sequence seq theo downstream (1-based, on dinh theo seq cu roi id)
--    de tranh va cham khi don nhieu adType ve cung 1 unique (downstreamId, seq).
WITH renum AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY "downstreamId"
           ORDER BY "seq" ASC, "createdAt" ASC, id ASC
         ) AS rn
  FROM "MediaAdOrder"
)
UPDATE "MediaAdOrder" mao
SET "seq" = renum.rn
FROM renum
WHERE mao.id = renum.id;

-- 4. New unique scoped chi theo downstream
CREATE UNIQUE INDEX "MediaAdOrder_downstreamId_seq_key"
  ON "MediaAdOrder"("downstreamId", "seq");
