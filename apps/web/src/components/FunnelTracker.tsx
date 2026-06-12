"use client";

import { useEffect, useRef } from "react";
import type { FunnelEventName } from "@/lib/track";

interface FunnelTrackerProps {
  event: FunnelEventName;
  reportId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Fires a funnel event exactly once when this component mounts.
 * Used for events that originate on the client (landing_view, report_delivered).
 * Server-side events call trackEvent() directly in the API route handler.
 */
export function FunnelTracker({ event, reportId, metadata }: FunnelTrackerProps) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventName: event, reportId, metadata }),
      keepalive: true,
    }).catch(() => {
      // Tracking failures must never break the page
    });
  }, [event, reportId, metadata]);
  return null;
}
