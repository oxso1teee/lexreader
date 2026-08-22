// Post-extraction ownership and delivery. This module never inspects or
// transforms transcript contents; it only transfers an already-canonical
// terminal result to the originating LexReader tab and restores focus.

function contextMetadata(context) {
  return {
    requestId: context.requestId,
    videoId: context.videoId,
    originTabId: context.originTabId ?? null,
    originWindowId: context.originWindowId ?? null,
    youtubeTabId: context.youtubeTabId ?? null,
    youtubeWindowId: context.youtubeWindowId ?? null,
    createdByLexReader: context.createdByLexReader === true,
  };
}

function outcome(context, fields) {
  return { ...contextMetadata(context), ...fields };
}

/**
 * Required success ordering:
 * terminal result -> origin bridge ACK -> origin activation/focus -> owned
 * temporary-tab removal. A failed step stops the later destructive steps.
 */
export async function deliverResultAndRestoreOrigin(
  context,
  terminalResult,
  { chromeApi = chrome, onEvent = () => {} } = {},
) {
  const emit = (event, extra = {}) => onEvent(event, contextMetadata(context), extra);

  emit("background_deliver_started", { ok: terminalResult.ok === true });
  if (!Number.isInteger(context.originTabId)) {
    emit("origin_tab_message_failed", { error: "origin_tab_missing" });
    return outcome(context, {
      ok: false,
      acknowledged: false,
      activated: false,
      temporaryTabClosed: false,
      error: "origin_delivery_failed",
      internalReason: "origin_tab_missing",
    });
  }

  let acknowledgement;
  try {
    emit("origin_tab_message_sent");
    acknowledgement = await chromeApi.tabs.sendMessage(context.originTabId, {
      type: "LEXREADER_TRANSCRIPT_RESULT",
      requestId: context.requestId,
      result: terminalResult,
    });
  } catch (error) {
    emit("origin_tab_message_failed", {
      error: error instanceof Error ? error.message : String(error ?? "unknown"),
    });
    return outcome(context, {
      ok: false,
      acknowledged: false,
      activated: false,
      temporaryTabClosed: false,
      error: "origin_delivery_failed",
      internalReason: "origin_message_rejected",
    });
  }

  if (acknowledgement?.ok !== true || acknowledgement.requestId !== context.requestId) {
    emit("origin_tab_message_failed", { error: "invalid_origin_acknowledgement" });
    return outcome(context, {
      ok: false,
      acknowledged: false,
      activated: false,
      temporaryTabClosed: false,
      error: "origin_delivery_failed",
      internalReason: "invalid_origin_acknowledgement",
    });
  }
  emit("origin_tab_message_acknowledged");

  try {
    emit("origin_tab_activate_started");
    await chromeApi.tabs.update(context.originTabId, { active: true });
    if (Number.isInteger(context.originWindowId) && chromeApi.windows?.update) {
      await chromeApi.windows.update(context.originWindowId, { focused: true });
    }
    emit("origin_tab_activated");
  } catch (error) {
    emit("origin_tab_activation_failed", {
      error: error instanceof Error ? error.message : String(error ?? "unknown"),
    });
    return outcome(context, {
      ok: false,
      acknowledged: true,
      activated: false,
      temporaryTabClosed: false,
      error: "origin_activation_failed",
    });
  }

  if (!context.createdByLexReader) {
    emit("temporary_tab_close_skipped", { reason: "not_created_by_lexreader" });
    return outcome(context, {
      ok: true,
      acknowledged: true,
      activated: true,
      temporaryTabClosed: false,
      closeSkipped: true,
    });
  }

  if (!Number.isInteger(context.youtubeTabId)) {
    emit("temporary_tab_close_failed", { error: "youtube_tab_missing" });
    return outcome(context, {
      ok: false,
      acknowledged: true,
      activated: true,
      temporaryTabClosed: false,
      error: "temporary_tab_close_failed",
      internalReason: "youtube_tab_missing",
    });
  }

  try {
    emit("temporary_tab_close_started");
    await chromeApi.tabs.remove(context.youtubeTabId);
    emit("temporary_tab_closed");
  } catch (error) {
    emit("temporary_tab_close_failed", {
      error: error instanceof Error ? error.message : String(error ?? "unknown"),
    });
    return outcome(context, {
      ok: false,
      acknowledged: true,
      activated: true,
      temporaryTabClosed: false,
      error: "temporary_tab_close_failed",
    });
  }

  return outcome(context, {
    ok: true,
    acknowledged: true,
    activated: true,
    temporaryTabClosed: true,
  });
}
