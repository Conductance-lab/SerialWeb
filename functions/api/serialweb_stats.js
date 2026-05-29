const corsHeaders = {
  "content-type": "application/json; charset=UTF-8",
  "Access-Control-Allow-Origin": "*",
};

function getAnalyticsStore(env) {
  if (env?.page_analytics) {
    return env.page_analytics;
  }
  if (typeof page_analytics !== "undefined") {
    return page_analytics;
  }
  return null;
}

// serialweb_view_count is only used for page-view analytics.
export async function onRequestGet({ env }) {
  const store = getAnalyticsStore(env);
  if (!store) {
    return new Response(
      JSON.stringify({
        error: "KV page_analytics is not bound",
        serialweb_view_count: 0,
      }),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }

  const viewCount = Number(await store.get("serialweb_view_count")) || 0;

  return new Response(
    JSON.stringify({
      serialweb_view_count: viewCount,
    }),
    {
      headers: corsHeaders,
    }
  );
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}