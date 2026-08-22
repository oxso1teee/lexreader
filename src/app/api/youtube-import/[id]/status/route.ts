import { createClient } from "@/lib/supabase/server";
import { getYoutubeImportStatus } from "@/lib/youtube-ingestion/service";

// Authenticated status poll for an in-progress YouTube import (§14 of the
// Slice 12 backend brief). Returns only the fields the UI needs to poll
// safely and navigate when ready -- never worker internals, never raw
// provider errors.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const outcome = await getYoutubeImportStatus(supabase, user.id, id);
  if (!outcome) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  return Response.json({
    id: outcome.textId,
    status: outcome.status,
    stage: outcome.stage,
    error: outcome.error,
    readyRoute: outcome.readyRoute ?? null,
  });
}
