-- Update existing scoring profiles in the database to adjust parameters to the new fair scoring logic
UPDATE "ScoringProfile"
SET "rulesEngine" = jsonb_set(
  "rulesEngine",
  '{rules}',
  (
    SELECT jsonb_agg(
      CASE 
        WHEN elem->>'code' = 'HARSH_BRAKING' THEN 
          CASE 
            WHEN elem ? 'deductionPerSeverityUnit' THEN 
              elem || '{"deductionPerSeverityUnit": 0.25, "maxDeduction": 20.0}'::jsonb
            ELSE 
              elem || '{"maxDeduction": 20.0}'::jsonb
          END
        WHEN elem->>'code' = 'HARSH_CORNERING' THEN 
          CASE 
            WHEN elem ? 'deductionPerSeverityUnit' THEN 
              elem || '{"deductionPerSeverityUnit": 0.25, "maxDeduction": 20.0}'::jsonb
            ELSE 
              elem || '{"maxDeduction": 20.0}'::jsonb
          END
        WHEN elem->>'code' = 'HARSH_ACCELERATION' THEN 
          CASE 
            WHEN elem ? 'deductionPerSeverityUnit' THEN 
              elem || '{"deductionPerSeverityUnit": 0.20, "maxDeduction": 10.0}'::jsonb
            ELSE 
              elem || '{"maxDeduction": 10.0}'::jsonb
          END
        ELSE elem
      END
    )
    FROM jsonb_array_elements("rulesEngine"->'rules') elem
  )
)
WHERE "rulesEngine"->'rules' IS NOT NULL;
