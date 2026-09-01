import { query } from '../../../lib/db.cjs';

const THREAT_LEVELS = ['high', 'watch', 'low'];
const TYPES = ['guest', 'staff'];

function sanitizeRelations(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((r) => r && Number.isFinite(Number(r.id)))
    .map((r) => ({ id: Number(r.id), note: String(r.note || '') }));
}

export async function GET() {
  const { rows } = await query(
    'SELECT id, name, type, threat, photo_url AS "photoUrl", basic_info AS "basicInfo", secrets, relations, logged_by, updated_at FROM files ORDER BY updated_at DESC'
  );
  return Response.json(rows);
}

export async function POST(request) {
  const body = await request.json();
  const name = (body.name || '').trim();
  const loggedBy = (body.loggedBy || '').trim();
  const type = TYPES.includes(body.type) ? body.type : 'guest';
  const threat = THREAT_LEVELS.includes(body.threat) ? body.threat : 'low';
  const photoUrl = body.photoUrl || '';
  const basicInfo = body.basicInfo || '';
  const secrets = body.secrets || '';
  const relations = sanitizeRelations(body.relations);

  if (!name || !loggedBy) {
    return Response.json({ error: 'name and loggedBy are required' }, { status: 400 });
  }

  const { rows } = await query(
    `INSERT INTO files (name, type, threat, photo_url, basic_info, secrets, relations, logged_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, name, type, threat, photo_url AS "photoUrl", basic_info AS "basicInfo", secrets, relations, logged_by, updated_at`,
    [name, type, threat, photoUrl, basicInfo, secrets, JSON.stringify(relations), loggedBy]
  );
  return Response.json(rows[0], { status: 201 });
}
