-- Update existing scoring profiles in the database to reduce OVERSPEEDING penalty (deduction rate to 6.0, max deduction to 20.0)
UPDATE "ScoringProfile"
SET "rulesEngine" = jsonb_set(
  "rulesEngine",
  '{rules}',
  (
    SELECT jsonb_agg(
      CASE 
        WHEN elem->>'code' = 'OVERSPEEDING' THEN 
          elem || '{"deductionPer100Km": 6.0, "maxDeduction": 20.0}'::jsonb
        ELSE elem
      END
    )
    FROM jsonb_array_elements("rulesEngine"->'rules') elem
  )
)
WHERE "rulesEngine"->'rules' IS NOT NULL;
