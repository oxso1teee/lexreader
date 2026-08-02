// Совпадает с fallback-хостом в posthog-client.ts/posthog-server.ts — если
// CSP не будет знать про дефолтный хост, окажется заблокирован именно
// fallback-путь (когда NEXT_PUBLIC_POSTHOG_HOST не задан).
const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

// Та же логика region-detection, что внутри самого SDK
// (node_modules/posthog-js/dist/module.js, RequestRouter.region/endpointFor):
// только us/eu Cloud раздают статику (array.js, config.js) с отдельного
// "-assets"-поддомена, capture/decide идут на исходный host. Любой другой
// host (self-hosted/custom instance) обслуживает всё с одного адреса — SDK
// в этом случае вообще не строит отдельный assets-домен, поэтому и CSP не
// должна его придумывать.
const CLOUD_REGION = /^https:\/\/(eu|us)\.i\.posthog\.com$/;

export interface PostHogCspHosts {
  apiHost: string;
  assetsHost: string;
}

export function getPostHogCspHosts(configuredHost: string | undefined): PostHogCspHosts {
  const apiHost = (configuredHost || DEFAULT_POSTHOG_HOST).trim().replace(/\/$/, "");
  const match = apiHost.match(CLOUD_REGION);
  const assetsHost = match ? `https://${match[1]}-assets.i.posthog.com` : apiHost;
  return { apiHost, assetsHost };
}
