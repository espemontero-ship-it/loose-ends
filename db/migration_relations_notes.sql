ALTER TABLE files ADD COLUMN IF NOT EXISTS basic_info TEXT NOT NULL DEFAULT '';
ALTER TABLE files ADD COLUMN IF NOT EXISTS relations JSONB NOT NULL DEFAULT '[]';

UPDATE files f
SET relations = COALESCE((
  SELECT jsonb_agg(jsonb_build_object('id', rid, 'note', ''))
  FROM unnest(f.relation_ids) AS rid
), '[]'::jsonb)
WHERE f.relation_ids IS NOT NULL AND array_length(f.relation_ids, 1) > 0;

ALTER TABLE files DROP COLUMN IF EXISTS relation_ids;
