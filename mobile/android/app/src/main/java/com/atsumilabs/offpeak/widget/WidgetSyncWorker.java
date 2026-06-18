package com.atsumilabs.offpeak.widget;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.work.Data;
import androidx.work.ExistingWorkPolicy;
import androidx.work.OneTimeWorkRequest;
import androidx.work.OutOfQuotaPolicy;
import androidx.work.WorkManager;
import androidx.work.WorkerParameters;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.jstasks.HeadlessJsTaskConfig;
import com.reactnativeandroidwidget.oss.HeadlessJsTaskWorker;

/**
 * Runs the "OffPeakWidgetSync" headless JS task (widgetSync.ts) so the ⟳ button
 * can fetch fresh prices even while the app is closed. The JS task writes the
 * store; when it finishes we broadcast APPWIDGET_UPDATE so the native provider
 * re-reads and repaints. Reuses the react-native-android-widget generic
 * headless worker base (WorkManager + HeadlessJsTaskService plumbing).
 */
public class WidgetSyncWorker extends HeadlessJsTaskWorker {
    private static final String TASK_NAME = "OffPeakWidgetSync";

    public WidgetSyncWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    /** Enqueue a one-shot, expedited sync for one widget. */
    public static void enqueue(Context context, int widgetId, boolean force) {
        Data data = new Data.Builder()
            .putIntArray("widgetIds", new int[]{widgetId})
            .putBoolean("force", force)
            .build();

        OneTimeWorkRequest req = new OneTimeWorkRequest.Builder(WidgetSyncWorker.class)
            .setInputData(data)
            .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
            .build();

        WorkManager.getInstance(context).enqueueUniqueWork(
            "offpeak-widget-sync-" + widgetId,
            ExistingWorkPolicy.REPLACE,
            req);
    }

    @Nullable
    @Override
    protected HeadlessJsTaskConfig getTaskConfig(Data data) {
        WritableMap args = Arguments.createMap();
        WritableArray ids = Arguments.createArray();
        int[] widgetIds = data.getIntArray("widgetIds");
        if (widgetIds != null) {
            for (int id : widgetIds) ids.pushInt(id);
        }
        args.putArray("widgetIds", ids);
        args.putBoolean("force", data.getBoolean("force", true));

        // name, args, timeout(ms), allowedInForeground
        return new HeadlessJsTaskConfig(TASK_NAME, args, 30 * 1000, true);
    }

    @Override
    public void onHeadlessJsTaskFinish(int taskId) {
        // The JS task has written the store — poke the widget to repaint.
        BaseOffPeakWidget.updateAll(getApplicationContext());
        super.onHeadlessJsTaskFinish(taskId);
    }
}
