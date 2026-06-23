-- Update existing scoring profiles in the database to adjust parameters to the new fair scoring logic
UPDATE "ScoringProfile"
SET "rulesEngine" = jsonb_set(
  "rulesEngine",
  '{rules}',
  (
    SELECT jsonb_agg(
      CASE 
        WHEN elem->>'code' = 'OVERSPEEDING' THEN 
          elem || '{"deductionPer100Km": 6.0, "maxDeduction": 20.0}'::jsonb
        WHEN elem->>'code' = 'DEVICE_UNPLUGGED' THEN 
          elem || '{"deductionPerEvent": 10.0, "maxDeduction": 30.0}'::jsonb
        WHEN elem->>'code' = 'EXCESSIVE_IDLING' THEN 
          elem || '{"deductionPer100Km": 5.0, "maxDeduction": 15.0}'::jsonb
        WHEN elem->>'code' = 'HARSH_ACCELERATION' THEN 
          CASE 
            WHEN elem ? 'deductionPerSeverityUnit' THEN 
              elem || '{"deductionPerSeverityUnit": 6.0, "maxDeduction": 15.0}'::jsonb
            ELSE 
              elem || '{"deductionPer100Km": 6.0, "maxDeduction": 15.0}'::jsonb
          END
        ELSE elem
      END
    )
    FROM jsonb_array_elements("rulesEngine"->'rules') elem
  )
)
WHERE "rulesEngine"->'rules' IS NOT NULL;
