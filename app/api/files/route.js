import { query } from '../../../lib/db.cjs';

const THREAT_LEVELS = ['high', 'watch', 'low'];

function sanitizeRelations(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((r) => r && Number.isFinite(Number(r.id)))
    .map((r) => ({ id: Number(r.id), note: String(r.note || '') }));
}

export async function GET() {
  const { rows } = await query(
    'SELECT id, name, threat, basic_info AS "basicInfo", secrets, relations, logged_by, updated_at FROM files ORDER BY updated_at DESC'
  );
  return Response.json(rows);
}

export async function POST(request) {
  const body = await request.json();
  const name = (body.name || '').trim();
  const loggedBy = (body.loggedBy || '').trim();
  const threat = THREAT_LEVELS.includes(body.threat) ? body.threat : 'low';
  const basicInfo = body.basicInfo || '';
  const secrets = body.secrets || '';
  const relations = sanitizeRelations(body.relations);

  if (!name || !loggedBy) {
    return Response.json({ error: 'name and loggedBy are required' }, { status: 400 });
  }

  const { rows } = await query(
    `INSERT INTO files (name, threat, basic_info, secrets, relations, logged_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, threat, basic_info AS "basicInfo", secrets, relations, logged_by, updated_at`,
    [name, threat, basicInfo, secrets, JSON.stringify(relations), loggedBy]
  );
  return Response.json(rows[0], { status: 201 });
}
