const downloadHeaders = {
  "content-type": "application/octet-stream",
  "content-disposition": "attachment; filename*=UTF-8''SerialWeb%E4%B8%B2%E5%8F%A3%E8%B0%83%E8%AF%95.html",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "Access-Control-Allow-Origin": "*",
};

function errorResponse(message, status = 500) {
  return new Response(message, {
    status,
    headers: {
      "content-type": "text/plain; charset=UTF-8",
      "cache-control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function onRequestGet({ request, env }) {
  if (!env?.ASSETS || typeof env.ASSETS.fetch !== "function") {
    return errorResponse("Static asset binding is not available.");
  }

  const indexUrl = new URL("/index.html", request.url);
  const assetResponse = await env.ASSETS.fetch(new Request(indexUrl, { method: "GET" }));

  if (!assetResponse.ok) {
    return errorResponse("index.html was not found in deployed assets.", assetResponse.status);
  }

  return new Response(assetResponse.body, {
    status: 200,
    headers: downloadHeaders,
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
