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
async function handlePageView(env) {
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

  const nextCount = (Number(await store.get("serialweb_view_count")) || 0) + 1;
  await store.put("serialweb_view_count", String(nextCount));

  return new Response(
    JSON.stringify({
      serialweb_view_count: nextCount,
    }),
    {
      headers: corsHeaders,
    }
  );
}

export async function onRequestGet({ env }) {
  return handlePageView(env);
}

export async function onRequestPost({ env }) {
  return handlePageView(env);
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
  });
}