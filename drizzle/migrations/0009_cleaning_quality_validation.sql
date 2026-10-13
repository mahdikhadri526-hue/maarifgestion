ALTER TABLE public.cleaning_logs ADD COLUMN IF NOT EXISTS quality_validator text;
ALTER TABLE public.cleaning_logs ADD COLUMN IF NOT EXISTS quality_conformity text CHECK (quality_conformity IN ('C', 'NC'));
COMMENT ON COLUMN public.cleaning_logs.quality_validator IS 'Independent quality-service validator; manager visa remains in visa_manager.';
COMMENT ON COLUMN public.cleaning_logs.quality_conformity IS 'Quality-service assessment: C (conforme), NC (non conforme), or null (not assessed).';