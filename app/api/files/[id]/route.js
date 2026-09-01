import { query } from '../../../../lib/db.cjs';

const THREAT_LEVELS = ['high', 'watch', 'low'];
const TYPES = ['guest', 'staff'];

function sanitizeRelations(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((r) => r && Number.isFinite(Number(r.id)))
    .map((r) => ({ id: Number(r.id), note: String(r.note || '') }));
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const body = await request.json();
  const name = (body.name || '').trim();
  const loggedBy = (body.loggedBy || '').trim();
  const type = TYPES.includes(body.type) ? body.type : 'guest';
  const threat = THREAT_LEVELS.includes(body.threat) ? body.threat : 'low';
  const basicInfo = body.basicInfo || '';
  const secrets = body.secrets || '';
  const relations = sanitizeRelations(body.relations);

  if (!name || !loggedBy) {
    return Response.json({ error: 'name and loggedBy are required' }, { status: 400 });
  }

  const { rows } = await query(
    `UPDATE files SET name = $1, type = $2, threat = $3, basic_info = $4, secrets = $5, relations = $6, logged_by = $7, updated_at = now()
     WHERE id = $8
     RETURNING id, name, type, threat, basic_info AS "basicInfo", secrets, relations, logged_by, updated_at`,
    [name, type, threat, basicInfo, secrets, JSON.stringify(relations), loggedBy, id]
  );

  if (rows.length === 0) {
    return Response.json({ error: 'not found' }, { status: 404 });
  }
  return Response.json(rows[0]);
}
