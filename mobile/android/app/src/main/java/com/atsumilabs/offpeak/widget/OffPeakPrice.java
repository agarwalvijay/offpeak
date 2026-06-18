package com.atsumilabs.offpeak.widget;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.view.View;
import android.widget.RemoteViews;

import com.atsumilabs.offpeak.R;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Native banner widget: price + level (left), utility + last-hour trend bars
 * (middle), hour-average + updated + ⟳ (right). Reads its row from the shared
 * store via BaseOffPeakWidget; never fetches.
 *
 * The trend bars are drawn to a FIXED-resolution bitmap we size ourselves (not
 * the widget's reported dimensions), so the stale-dimension clipping that broke
 * the old JS widget can't happen here.
 */
public class OffPeakPrice extends BaseOffPeakWidget {
    // Fixed bitmap resolution for the trend; the ImageView scales it (fitXY).
    private static final int SPARK_W = 360;
    private static final int SPARK_H = 120;

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

        // "ComEd · North" (drop the · when there's no real zone).
        String title = d.optString("title", "OffPeak");
        String sub = optClean(d, "sub");
        String line = (!sub.isEmpty() && !sub.equals("real-time")) ? title + " · " + sub : title;
        v.setTextViewText(R.id.widget_title, line);

        String avg = optClean(d, "hourAvg");
        v.setTextViewText(R.id.widget_avg, avg.isEmpty() ? "" : "avg " + avg);
        v.setTextViewText(R.id.widget_updated, optClean(d, "updated"));

        Bitmap spark = drawTrend(d.optJSONArray("points"), color);
        if (spark != null) {
            v.setImageViewBitmap(R.id.widget_spark, spark);
            v.setViewVisibility(R.id.widget_spark, View.VISIBLE);
        } else {
            v.setViewVisibility(R.id.widget_spark, View.GONE);
        }
    }

    @Override
    protected void bindPlaceholder(Context context, RemoteViews v) {
        v.setTextViewText(R.id.widget_price, "--¢");
        v.setTextViewText(R.id.widget_level, "");
        v.setTextViewText(R.id.widget_title, "OffPeak");
        v.setTextViewText(R.id.widget_avg, "");
        v.setTextViewText(R.id.widget_updated, "Open the app to load");
        v.setViewVisibility(R.id.widget_spark, View.GONE);
    }

    /** Bar sparkline of recent prices into a fixed-size bitmap. Bars fade in
     *  toward the newest; height is min→max normalized. null if too few points. */
    private static Bitmap drawTrend(JSONArray points, int color) {
        if (points == null || points.length() < 2) return null;
        int n = points.length();
        double min = Double.MAX_VALUE, max = -Double.MAX_VALUE;
        double[] vals = new double[n];
        for (int i = 0; i < n; i++) {
            double val = points.optDouble(i, 0);
            vals[i] = val;
            if (val < min) min = val;
            if (val > max) max = val;
        }
        double range = max - min;

        Bitmap bmp = Bitmap.createBitmap(SPARK_W, SPARK_H, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);

        float slot = (float) SPARK_W / n;
        float barW = slot * 0.6f;
        float minBar = SPARK_H * 0.12f;
        int rgb = color & 0x00FFFFFF;

        for (int i = 0; i < n; i++) {
            double t = range > 0 ? (vals[i] - min) / range : 0.5;
            float h = (float) (minBar + t * (SPARK_H - minBar));
            float left = i * slot + (slot - barW) / 2f;
            float top = SPARK_H - h;
            // Fade older bars; newest is full strength.
            int alpha = (int) (110 + 145f * i / Math.max(1, n - 1));
            p.setColor((alpha << 24) | rgb);
            float r = barW / 2.5f;
            c.drawRoundRect(new RectF(left, top, left + barW, SPARK_H), r, r, p);
        }
        return bmp;
    }

    private static int parseColor(String hex, int fallback) {
        try {
            return Color.parseColor(hex);
        } catch (Exception e) {
            return fallback;
        }
    }
}
