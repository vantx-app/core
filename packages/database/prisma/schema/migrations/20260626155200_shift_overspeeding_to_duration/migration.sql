-- Update existing scoring profiles in the database to shift OVERSPEEDING from event-based count to duration-based severity.
-- We remove "deductionPer100Km" and replace it with "deductionPerSeverityUnit": 0.0167.
UPDATE "ScoringProfile"
SET "rulesEngine" = jsonb_set(
  "rulesEngine",
  '{rules}',
  (
    SELECT jsonb_agg(
      CASE 
        WHEN elem->>'code' = 'OVERSPEEDING' THEN 
          (elem - 'deductionPer100Km') || '{"deductionPerSeverityUnit": 0.0167, "maxDeduction": 20.0}'::jsonb
        ELSE elem
      END
    )
    FROM jsonb_array_elements("rulesEngine"->'rules') elem
  )
)
WHERE "rulesEngine"->'rules' IS NOT NULL;
