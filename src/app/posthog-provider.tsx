"use client";
import { useEffect } from "react";
import { initPostHog, identify } from "@/lib/posthog-client";

export default function PostHogProvider({ userId }: { userId?: string }) {
  useEffect(() => {
    initPostHog();
    if (userId) identify(userId);
  }, [userId]);
  return null;
}
