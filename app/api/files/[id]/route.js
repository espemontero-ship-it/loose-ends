import { query } from '../../../../lib/db.cjs';

const THREAT_LEVELS = ['high', 'watch', 'low'];

export async function PATCH(request, { params }) {
  const { id } = await params;
  const body = await request.json();
  const name = (body.name || '').trim();
  const loggedBy = (body.loggedBy || '').trim();
  const threat = THREAT_LEVELS.includes(body.threat) ? body.threat : 'low';
  const secrets = body.secrets || '';
  const relationIds = Array.isArray(body.relationIds) ? body.relationIds.map(Number) : [];

  if (!name || !loggedBy) {
    return Response.json({ error: 'name and loggedBy are required' }, { status: 400 });
  }

  const { rows } = await query(
    `UPDATE files SET name = $1, threat = $2, secrets = $3, relation_ids = $4, logged_by = $5, updated_at = now()
     WHERE id = $6
     RETURNING id, name, threat, secrets, relation_ids AS "relationIds", logged_by, updated_at`,
    [name, threat, secrets, relationIds, loggedBy, id]
  );

  if (rows.length === 0) {
    return Response.json({ error: 'not found' }, { status: 404 });
  }
  return Response.json(rows[0]);
}
