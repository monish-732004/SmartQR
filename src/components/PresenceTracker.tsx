"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export const PRESENCE_CHANNEL = "online-students";

export interface OnlineStudent {
  user_id: string;
  name: string;
  email: string;
  registration_id: string | null;
  online_at: string;
}

/**
 * Marks a signed-in student as online for librarians via Realtime Presence.
 * Presence entries disappear on their own when the tab closes or the
 * connection drops, so "online" always means a live connection right now.
 * Renders nothing.
 */
export default function PresenceTracker({
  userId,
  name,
  email,
  registrationId,
}: {
  userId: string;
  name: string;
  email: string;
  registrationId: string | null;
}) {
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: userId } },
    });

    channel.subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return;
      const payload: OnlineStudent = {
        user_id: userId,
        name,
        email,
        registration_id: registrationId,
        online_at: new Date().toISOString(),
      };
      await channel.track(payload);
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, name, email, registrationId]);

  return null;
}
