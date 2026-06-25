-- Add contact/phone/email/notes + name to Downstream
-- to match ha-nguon-media.docx fields
ALTER TABLE "Downstream"
  ADD COLUMN "name"    TEXT,
  ADD COLUMN "contact" TEXT,
  ADD COLUMN "phone"   TEXT,
  ADD COLUMN "email"   TEXT,
  ADD COLUMN "notes"   TEXT;
