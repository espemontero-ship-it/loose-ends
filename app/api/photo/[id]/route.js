const { query } = require('../../../../lib/db.cjs');
const { descargarBlob } = require('../../../../lib/blob.cjs');

export async function GET(request, { params }) {
  const { id } = await params;
  const { rows } = await query('SELECT photo_url FROM files WHERE id = $1', [id]);
  const photoUrl = rows[0]?.photo_url;
  if (!photoUrl) return new Response('not found', { status: 404 });

  const buffer = await descargarBlob(photoUrl);
  if (!buffer) return new Response('not found', { status: 404 });

  return new Response(buffer, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
