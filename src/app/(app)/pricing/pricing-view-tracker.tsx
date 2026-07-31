"use client";
import { useEffect } from "react";
import { track } from "@/lib/posthog-client";

export default function PricingViewTracker({ reason }: { reason?: string }) {
  useEffect(() => {
    track("paywall_viewed", { reason });
  }, [reason]);
  return null;
}
