import { query } from '../../../../lib/db.cjs';

const THREAT_LEVELS = ['high', 'watch', 'low'];

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
  const threat = THREAT_LEVELS.includes(body.threat) ? body.threat : 'low';
  const basicInfo = body.basicInfo || '';
  const secrets = body.secrets || '';
  const relations = sanitizeRelations(body.relations);

  if (!name || !loggedBy) {
    return Response.json({ error: 'name and loggedBy are required' }, { status: 400 });
  }

  const { rows } = await query(
    `UPDATE files SET name = $1, threat = $2, basic_info = $3, secrets = $4, relations = $5, logged_by = $6, updated_at = now()
     WHERE id = $7
     RETURNING id, name, threat, basic_info AS "basicInfo", secrets, relations, logged_by, updated_at`,
    [name, threat, basicInfo, secrets, JSON.stringify(relations), loggedBy, id]
  );

  if (rows.length === 0) {
    return Response.json({ error: 'not found' }, { status: 404 });
  }
  return Response.json(rows[0]);
}
