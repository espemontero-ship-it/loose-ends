import { query } from '../../../lib/db.cjs';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET() {
  const sql = readFileSync(join(process.cwd(), 'db', 'migration_type.sql'), 'utf8');
  await query(sql);
  return Response.json({ ok: true });
}
