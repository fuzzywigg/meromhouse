export async function onRequest() {
  return Response.json({
    ok: true,
    version: '0.1.0',
    updated: new Date().toISOString(),
  });
}
