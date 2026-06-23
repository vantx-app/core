-- Remove ACTIVE_FAULT_CODES from existing scoring profiles in the database
UPDATE "ScoringProfile"
SET "rulesEngine" = jsonb_set(
  "rulesEngine",
  '{rules}',
  (
    SELECT jsonb_agg(elem)
    FROM jsonb_array_elements("rulesEngine"->'rules') elem
    WHERE elem->>'code' <> 'ACTIVE_FAULT_CODES'
  )
)
WHERE "rulesEngine"->'rules' IS NOT NULL;
