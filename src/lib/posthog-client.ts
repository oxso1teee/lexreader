"use client";
import posthog from "posthog-js";

let initialized = false;

// M3 Slice 3: capture_pageview:true also autocaptures on history.replaceState,
// which Library's search uses to reflect ?q=<text> in the URL (§9 of the plan
// doc forbids ever sending search text to PostHog). mask_personal_data_properties
// strips listed query params from every captured $current_url/$pathname before
// the event is sent, so this can't leak through pageview autocapture even
// though the explicit track() calls never include the query themselves.
// Extracted as a pure function (see posthog-client.test.ts) so the masking
// config is verified without needing to mock posthog-js's init().
export function getPostHogInitConfig(apiHost: string | undefined) {
  return {
    api_host: apiHost ?? "https://us.i.posthog.com",
    capture_pageview: true,
    autocapture: false,
    mask_personal_data_properties: true,
    custom_personal_data_properties: ["q"],
  };
}

export function initPostHog() {
  if (initialized || typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, getPostHogInitConfig(process.env.NEXT_PUBLIC_POSTHOG_HOST));
  initialized = true;
}

export function track(event: string, props?: Record<string, unknown>) {
  if (!initialized) return;
  posthog.capture(event, props);
}

export function identify(userId: string) {
  if (!initialized) return;
  posthog.identify(userId);
}
