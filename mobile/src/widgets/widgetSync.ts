import { AppRegistry } from "react-native";
import { ensureWidgetBaseUrls, fetchWidgetPrice } from "./widgetData";
import { requestWidgetRepaint } from "./widgetBridge";

/**
 * One fetch path, three triggers:
 *   - periodic   → the background price-alert task calls refreshAllWidgets()
 *   - on-demand  → the native ⟳ enqueues WidgetSyncWorker, which runs the
 *                  "OffPeakWidgetSync" headless task below even with the app closed
 *   - app open   → storeAppSnapshot publishes the active row directly
 */

export const WIDGET_SYNC_TASK = "OffPeakWidgetSync";

/** Fetch fresh data for the given widgets (or just the active row) into the
 *  store, each under a soft timeout so the headless task can't hang. */
export async function syncWidgets(ids?: number[], force = true): Promise<void> {
  ensureWidgetBaseUrls();
  // id 0 → resolves to the active selection, so a freshly-added widget (and
  // app-following widgets) get data even before any binding is recorded.
  const list = ids && ids.length ? [...new Set([...ids, 0])] : [0];
  for (const id of list) {
    await Promise.race([
      fetchWidgetPrice(id, force).catch(() => null),
      new Promise((resolve) => setTimeout(resolve, 12000)),
    ]);
  }
  requestWidgetRepaint();
}

/** Register the headless task the native WidgetSyncWorker invokes. Call once at
 *  module load (index.ts) so it exists in headless contexts too. */
export function registerWidgetSyncTask(): void {
  AppRegistry.registerHeadlessTask(
    WIDGET_SYNC_TASK,
    () =>
      async (data?: { widgetIds?: number[]; force?: boolean }) => {
        const ids = data?.widgetIds?.length ? data.widgetIds : undefined;
        await syncWidgets(ids, data?.force ?? true);
      },
  );
}
