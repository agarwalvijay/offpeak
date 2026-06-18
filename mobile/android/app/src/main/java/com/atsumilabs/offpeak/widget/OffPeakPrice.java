package com.atsumilabs.offpeak.widget;

import android.content.Context;
import android.graphics.Color;
import android.widget.RemoteViews;

import com.atsumilabs.offpeak.R;

import org.json.JSONObject;

/**
 * Native banner widget: current price + level (left), utility + zone (middle),
 * hour-average + updated + ⟳ (right). Reads its row from the shared store via
 * BaseOffPeakWidget; never fetches — the JS data plane does that and writes the
 * store (so all 8 ISOs work with zero native per-utility code).
 */
public class OffPeakPrice extends BaseOffPeakWidget {

    @Override
    protected int layoutId() {
        return R.layout.widget_offpeak;
    }

    @Override
    protected void bind(Context context, RemoteViews v, JSONObject d) {
        int color = parseColor(d.optString("color", ""), 0xFFFFD166);

        v.setTextViewText(R.id.widget_price, d.optString("price", "--¢"));
        v.setTextColor(R.id.widget_price, color);

        v.setTextViewText(R.id.widget_level, optClean(d, "level"));
        v.setTextColor(R.id.widget_level, color);

        v.setTextViewText(R.id.widget_title, d.optString("title", "OffPeak"));
        v.setTextViewText(R.id.widget_sub, optClean(d, "sub"));

        String avg = optClean(d, "hourAvg");
        v.setTextViewText(R.id.widget_avg, avg.isEmpty() ? "" : "avg " + avg);
        v.setTextViewText(R.id.widget_updated, optClean(d, "updated"));
    }

    @Override
    protected void bindPlaceholder(Context context, RemoteViews v) {
        v.setTextViewText(R.id.widget_price, "--¢");
        v.setTextViewText(R.id.widget_level, "");
        v.setTextViewText(R.id.widget_title, "OffPeak");
        v.setTextViewText(R.id.widget_sub, "Open the app to load");
        v.setTextViewText(R.id.widget_avg, "");
        v.setTextViewText(R.id.widget_updated, "");
    }

    private static int parseColor(String hex, int fallback) {
        try {
            return Color.parseColor(hex);
        } catch (Exception e) {
            return fallback;
        }
    }
}
