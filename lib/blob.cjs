const { get } = require('@vercel/blob');

async function descargarBlob(url) {
  const resultado = await get(url, { access: 'private' });
  if (!resultado) return null;
  const arrayBuffer = await new Response(resultado.stream).arrayBuffer();
  return Buffer.from(arrayBuffer);
}

module.exports = { descargarBlob };
