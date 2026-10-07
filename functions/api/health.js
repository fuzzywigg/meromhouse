import { SECURITY_HEADERS } from '../_shared/security-headers.js';

export async function onRequest() {
  return Response.json(
    {
      ok: true,
      // This function answering is online. Callers map ok:false or
      // status "degraded"/"error", and a failed fetch, to the other states.
      status: 'online',
      version: '0.1.0',
      updated: new Date().toISOString(),
    },
    { headers: SECURITY_HEADERS },
  );
}
