// Cloudflare Pages Function — serves the podcast RSS feed at /feed.
// Fetches the feed server-side (no CORS issues in the browser) and caches it
// for 15 minutes at Cloudflare's edge.
//
// Set the FEED_URL environment variable in Cloudflare Pages
// (Settings → Environment variables). The fallback below is used if it's missing.

const DEFAULT_FEED_URL = 'https://anchor.fm/s/1060d0c44/podcast/rss';
const TTL = 900; // 15 minutes, in seconds

export async function onRequestGet(context) {
  const { request, env } = context;
  const feedUrl = (env && env.FEED_URL) || DEFAULT_FEED_URL;

  const cache = caches.default;
  const cacheKey = new Request(new URL('/feed', request.url).toString(), { method: 'GET' });

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  let upstream;
  try {
    upstream = await fetch(feedUrl, {
      headers: { 'User-Agent': 'PodcastSiteFeedProxy/1.0', Accept: 'application/rss+xml, application/xml, text/xml' },
      cf: { cacheTtl: TTL, cacheEverything: true },
    });
  } catch (err) {
    return new Response('Feed unavailable', { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }

  if (!upstream.ok) {
    return new Response(`Feed unavailable (${upstream.status})`, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }

  const body = await upstream.text();
  const response = new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': `public, max-age=${TTL}`,
      'Access-Control-Allow-Origin': '*',
    },
  });

  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
