import { query } from '../../../lib/db.cjs';

const THREAT_LEVELS = ['high', 'watch', 'low'];

export async function GET() {
  const { rows } = await query(
    'SELECT id, name, threat, secrets, relations, logged_by, updated_at FROM files ORDER BY updated_at DESC'
  );
  return Response.json(rows);
}

export async function POST(request) {
  const body = await request.json();
  const name = (body.name || '').trim();
  const loggedBy = (body.loggedBy || '').trim();
  const threat = THREAT_LEVELS.includes(body.threat) ? body.threat : 'low';
  const secrets = body.secrets || '';
  const relations = body.relations || '';

  if (!name || !loggedBy) {
    return Response.json({ error: 'name and loggedBy are required' }, { status: 400 });
  }

  const { rows } = await query(
    `INSERT INTO files (name, threat, secrets, relations, logged_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, threat, secrets, relations, logged_by, updated_at`,
    [name, threat, secrets, relations, loggedBy]
  );
  return Response.json(rows[0], { status: 201 });
}
