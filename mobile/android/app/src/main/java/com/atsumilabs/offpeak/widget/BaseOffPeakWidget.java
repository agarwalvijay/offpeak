package com.atsumilabs.offpeak.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.widget.RemoteViews;

import com.atsumilabs.offpeak.R;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.util.Iterator;

/**
 * Shared base for OffPeak home-screen widgets. Pure CONSUMER: reads the catalog
 * (widget_store.json) the JS data plane writes, resolves this widget's row
 * (bindings[id] → key → places[key].data), and hands it to the subclass to
 * paint. The data path, refresh wiring, and store lookup live here once; each
 * subclass supplies its layout + how to bind the fields.
 *
 * Native RemoteViews with match_parent → Android reflows on every
 * resize/rotation, so the JS-rendered bitmap clipping ("half widget") and the
 * blank-render are both structurally impossible.
 */
public abstract class BaseOffPeakWidget extends AppWidgetProvider {
    protected static final String STORE_FILE = "widget_store.json";
    protected static final String ACTION_REFRESH = "com.atsumilabs.offpeak.WIDGET_CLICK";

    /** All provider classes — broadcast targets so JS/worker can repaint each. */
    private static final Class<?>[] PROVIDERS = { OffPeakPrice.class };

    /** Layout to inflate for this widget shape. */
    protected abstract int layoutId();

    /** Paint the resolved pricing row into the inflated views. */
    protected abstract void bind(Context context, RemoteViews v, JSONObject data);

    /** Paint the "no data yet" state. */
    protected abstract void bindPlaceholder(Context context, RemoteViews v);

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) updateWidget(context, mgr, id);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager mgr, int id, Bundle opts) {
        updateWidget(context, mgr, id);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (ACTION_REFRESH.equals(intent.getAction())) {
            int id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,
                AppWidgetManager.INVALID_APPWIDGET_ID);
            if (id != AppWidgetManager.INVALID_APPWIDGET_ID) {
                showUpdating(context, AppWidgetManager.getInstance(context), id);
                WidgetSyncWorker.enqueue(context, id, true);
            }
        }
        super.onReceive(context, intent);
    }

    private void updateWidget(Context context, AppWidgetManager mgr, int id) {
        RemoteViews v = new RemoteViews(context.getPackageName(), layoutId());
        JSONObject d = readData(context, id);
        if (d != null) bind(context, v, d);
        else bindPlaceholder(context, v);

        // Tap anywhere → open the app.
        Intent open = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (open != null) {
            v.setOnClickPendingIntent(R.id.widget_root,
                PendingIntent.getActivity(context, 0, open,
                    PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        }

        // ⟳ → on-demand refresh broadcast back to THIS provider class.
        Intent refresh = new Intent(context, getClass());
        refresh.setAction(ACTION_REFRESH);
        refresh.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
        v.setOnClickPendingIntent(R.id.widget_refresh,
            PendingIntent.getBroadcast(context, id, refresh,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));

        mgr.updateAppWidget(id, v);
    }

    /** Visible "Updating…" feedback while the headless fetch runs. */
    private void showUpdating(Context context, AppWidgetManager mgr, int id) {
        RemoteViews v = new RemoteViews(context.getPackageName(), layoutId());
        v.setTextViewText(R.id.widget_updated, "Updating…");
        mgr.partiallyUpdateAppWidget(id, v);
    }

    /** Broadcast a repaint to every widget shape. Called by the JS bridge + worker. */
    public static void updateAll(Context context) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(context);
        for (Class<?> provider : PROVIDERS) {
            ComponentName cn = new ComponentName(context, provider);
            int[] ids = mgr.getAppWidgetIds(cn);
            if (ids == null || ids.length == 0) continue;
            Intent intent = new Intent(context, provider);
            intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
            context.sendBroadcast(intent);
        }
    }

    // ---- Store lookup (shared) ----------------------------------------------

    /** Resolve this widget's row: bindings[id] → key (or "active") → data. */
    private JSONObject readData(Context context, int id) {
        JSONObject store = readStore(context);
        if (store == null) return null;

        JSONObject places = store.optJSONObject("places");
        if (places == null || places.length() == 0) return null;

        JSONObject bindings = store.optJSONObject("bindings");
        String target = bindings != null ? bindings.optString(String.valueOf(id), "active") : "active";

        String key = "active".equals(target) ? store.optString("active", null) : target;
        if (key == null || !places.has(key)) key = store.optString("active", null);
        if (key == null || !places.has(key)) {
            Iterator<String> it = places.keys();
            if (it.hasNext()) key = it.next();
        }
        if (key == null) return null;

        JSONObject rec = places.optJSONObject(key);
        return rec != null ? rec.optJSONObject("data") : null;
    }

    private JSONObject readStore(Context context) {
        try {
            File f = new File(context.getFilesDir(), STORE_FILE);
            if (!f.exists()) return null;
            FileInputStream fis = new FileInputStream(f);
            byte[] bytes = new byte[(int) f.length()];
            int read = fis.read(bytes);
            fis.close();
            if (read <= 0) return null;
            return new JSONObject(new String(bytes, "UTF-8"));
        } catch (Exception e) {
            return null;
        }
    }

    protected static String optClean(JSONObject d, String key) {
        String s = d.optString(key, "");
        return (s == null || s.equals("null")) ? "" : s;
    }
}
