export async function onRequest() {
  return Response.json({
    ok: true,
    status: 'online',
    version: '0.1.0',
    updated: new Date().toISOString(),
  });
}
