// ============================================================
//  Relais Discord — Cloudflare Worker (gratuit)
//  But : faire transiter UNIQUEMENT les appels Discord par une
//  IP propre (Cloudflare), pour contourner le bannissement de
//  l'IP partagee de Render.
//
//  Deploiement : voir les instructions fournies dans le chat.
//  Ce Worker ne relaie que les 2 endpoints utilises par le site,
//  rien d'autre.
// ============================================================

const ALLOWED_PATHS = new Set([
  "/api/oauth2/token",
  "/api/users/@me",
]);

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Petit ping de sante pour verifier que le Worker tourne.
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response("Relais Discord actif.", { status: 200 });
    }

    if (!ALLOWED_PATHS.has(url.pathname)) {
      return new Response("Chemin non autorise.", { status: 403 });
    }

    // Reconstruit la requete vers le vrai Discord.
    const target = "https://discord.com" + url.pathname + url.search;
    const headers = new Headers(request.headers);
    headers.delete("host"); // laisse fetch() poser le bon Host

    const init = {
      method: request.method,
      headers,
      body: (request.method === "GET" || request.method === "HEAD") ? undefined : request.body,
    };

    const resp = await fetch(target, init);

    // Renvoie tel quel (statut + corps) au serveur Render.
    const outHeaders = new Headers(resp.headers);
    outHeaders.delete("content-encoding"); // evite les soucis de double-encodage
    outHeaders.delete("content-length");
    return new Response(resp.body, { status: resp.status, headers: outHeaders });
  },
};
