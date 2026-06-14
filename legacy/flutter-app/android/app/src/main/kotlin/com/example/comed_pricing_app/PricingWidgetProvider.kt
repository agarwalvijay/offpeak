package com.example.comed_pricing_app

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.Path
import android.os.Build
import android.text.format.DateFormat
import android.util.Log
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.SocketTimeoutException
import java.net.URL
import java.net.UnknownHostException
import java.util.Date

class PricingWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val TAG = "PricingWidget"
        private const val ACTION_AUTO_UPDATE =
            "com.example.comed_pricing_app.action.WIDGET_AUTO_UPDATE"
        private const val ACTION_MANUAL_REFRESH =
            "com.example.comed_pricing_app.action.WIDGET_MANUAL_REFRESH"
        private const val REFRESH_INTERVAL_MS = 2L * 60L * 1000L
        // Bitmap size kept well under the 1MB Binder IPC limit for
        // RemoteViews.setImageViewBitmap. 360x120 ARGB_8888 ≈ 170KB.
        private const val CHART_W = 360
        private const val CHART_H = 120
        private const val API_URL =
            "https://hourlypricing.comed.com/api?type=5minutefeed"
        private const val PREFS_NAME = "widget_pricing_cache"
        private const val PREF_CACHED_JSON = "cached_prices_json"
        private const val PREF_LAST_ERROR = "last_fetch_error"
        private const val COLOR_FRESH = Color.WHITE
        // Light red — readable on the blue gradient widget background.
        private const val COLOR_STALE = 0xFFFF8A8A.toInt()

        // Thresholds are written by the Flutter app via the shared_preferences
        // plugin, which stores them in this file with a "flutter." key prefix
        // and a base64 tag prefix on the stringified double value.
        private const val FLUTTER_PREFS_NAME = "FlutterSharedPreferences"
        private const val FLUTTER_KEY_PREFIX = "flutter."
        private const val FLUTTER_DOUBLE_PREFIX =
            "VGhpcyBpcyB0aGUgcHJlZml4IGZvciBEb3VibGUu"
        private const val DEFAULT_LOW = 3.0
        private const val DEFAULT_MEDIUM = 6.0
        private const val DEFAULT_HIGH = 10.0
        private const val COLOR_THRESHOLD_LOW = 0xFF4CAF50.toInt()
        private const val COLOR_THRESHOLD_MEDIUM = 0xFFFFEB3B.toInt()
        private const val COLOR_THRESHOLD_HIGH = 0xFFF44336.toInt()
    }

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        scheduleNext(context)
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        cancelSchedule(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        val app = context.applicationContext
        when (intent.action) {
            AppWidgetManager.ACTION_APPWIDGET_UPDATE -> {
                val mgr = AppWidgetManager.getInstance(app)
                val ids = intent.getIntArrayExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS)
                    ?: mgr.getAppWidgetIds(ComponentName(app, PricingWidgetProvider::class.java))
                val cached = loadCachedPrices(app)
                for (id in ids) {
                    if (cached.isEmpty()) {
                        renderLoading(app, mgr, id)
                    } else {
                        renderData(app, mgr, id, cached, fromCache = true)
                    }
                }
                val pending = goAsync()
                refreshAllAsync(app, pending)
                scheduleNext(context)
            }
            ACTION_AUTO_UPDATE -> {
                val pending = goAsync()
                refreshAllAsync(app, pending)
                scheduleNext(context)
            }
            ACTION_MANUAL_REFRESH -> {
                val mgr = AppWidgetManager.getInstance(app)
                val ids = mgr.getAppWidgetIds(
                    ComponentName(app, PricingWidgetProvider::class.java)
                )
                for (id in ids) {
                    renderRefreshing(app, mgr, id)
                }
                val pending = goAsync()
                refreshAllAsync(app, pending)
                scheduleNext(context)
            }
            else -> super.onReceive(context, intent)
        }
    }

    private fun refreshAllAsync(context: Context, pending: PendingResult?) {
        Thread {
            try {
                var fetchError: String? = null
                val fetched = try {
                    val r = fetchPricesWithRetry()
                    if (r.isEmpty()) fetchError = "empty response"
                    r
                } catch (e: Exception) {
                    val msg = "${e.javaClass.simpleName}: ${e.message ?: ""}".trim()
                    Log.w(TAG, "fetchPrices failed: $msg")
                    fetchError = msg
                    emptyList()
                }
                if (fetched.isNotEmpty()) {
                    saveCachedPrices(context, fetched)
                    saveLastError(context, null)
                } else {
                    saveLastError(context, fetchError)
                }
                val prices = if (fetched.isNotEmpty()) fetched else loadCachedPrices(context)
                val mgr = AppWidgetManager.getInstance(context)
                val ids = mgr.getAppWidgetIds(
                    ComponentName(context, PricingWidgetProvider::class.java)
                )
                val errToShow = if (fetched.isEmpty()) loadLastError(context) else null
                for (id in ids) {
                    renderData(
                        context,
                        mgr,
                        id,
                        prices,
                        fromCache = fetched.isEmpty(),
                        errorOverlay = errToShow
                    )
                }
            } finally {
                pending?.finish()
            }
        }.start()
    }

    private fun renderLoading(
        context: Context,
        mgr: AppWidgetManager,
        widgetId: Int
    ) {
        val views = RemoteViews(context.packageName, R.layout.widget_pricing)
        views.setTextViewText(R.id.widget_hour_avg, "…")
        views.setTextViewText(R.id.widget_summary, "Loading")
        views.setTextViewText(R.id.widget_updated, "")
        views.setImageViewBitmap(
            R.id.widget_chart,
            renderChart(emptyList(), CHART_W, CHART_H, loadThresholds(context))
        )
        attachClickHandler(context, views)
        mgr.updateAppWidget(widgetId, views)
    }

    private fun renderData(
        context: Context,
        mgr: AppWidgetManager,
        widgetId: Int,
        all: List<PricePoint>,
        fromCache: Boolean = false,
        errorOverlay: String? = null
    ) {
        val views = RemoteViews(context.packageName, R.layout.widget_pricing)

        if (all.isEmpty()) {
            views.setTextViewText(R.id.widget_hour_avg, "—")
            views.setTextViewText(R.id.widget_summary, "No data")
            views.setTextViewText(R.id.widget_updated, "")
        } else {
            val sorted = all.sortedBy { it.millisUtc }
            val current = sorted.last()
            val cutoff = current.millisUtc - 60L * 60L * 1000L
            val lastHour = sorted.filter { it.millisUtc >= cutoff }

            views.setTextViewText(
                R.id.widget_hour_avg,
                "${formatPrice(current.price)}¢"
            )

            if (lastHour.size >= 2) {
                val prices = lastHour.map { it.price }
                val avg = prices.average()
                val min = prices.min()
                val max = prices.max()
                val statsLine =
                    "1h avg ${formatPrice(avg)}¢  ·  Min ${formatPrice(min)}¢  ·  Max ${formatPrice(max)}¢"
                views.setTextViewText(
                    R.id.widget_summary,
                    if (errorOverlay != null) "ERR: $errorOverlay" else statsLine
                )
                val bmp = renderChart(prices, CHART_W, CHART_H, loadThresholds(context))
                views.setImageViewBitmap(R.id.widget_chart, bmp)
            } else {
                views.setTextViewText(
                    R.id.widget_summary,
                    if (errorOverlay != null) "ERR: $errorOverlay" else "Building history…"
                )
            }

            val ts = DateFormat.getTimeFormat(context).format(Date(current.millisUtc))
            views.setTextViewText(R.id.widget_updated, ts)
            views.setTextColor(
                R.id.widget_updated,
                if (fromCache) COLOR_STALE else COLOR_FRESH
            )
        }

        attachClickHandler(context, views)
        mgr.updateAppWidget(widgetId, views)
    }

    private fun prefs(context: Context): SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private fun saveCachedPrices(context: Context, prices: List<PricePoint>) {
        val arr = JSONArray()
        for (p in prices) {
            val obj = JSONObject()
            obj.put("m", p.millisUtc)
            obj.put("p", p.price)
            arr.put(obj)
        }
        prefs(context).edit().putString(PREF_CACHED_JSON, arr.toString()).apply()
    }

    private fun saveLastError(context: Context, msg: String?) {
        val e = prefs(context).edit()
        if (msg.isNullOrEmpty()) e.remove(PREF_LAST_ERROR) else e.putString(PREF_LAST_ERROR, msg)
        e.apply()
    }

    private fun loadLastError(context: Context): String? =
        prefs(context).getString(PREF_LAST_ERROR, null)

    private fun loadCachedPrices(context: Context): List<PricePoint> {
        val raw = prefs(context).getString(PREF_CACHED_JSON, null) ?: return emptyList()
        return try {
            val arr = JSONArray(raw)
            val out = ArrayList<PricePoint>(arr.length())
            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                out += PricePoint(obj.getLong("m"), obj.getDouble("p"))
            }
            out
        } catch (e: Exception) {
            emptyList()
        }
    }

    private fun attachClickHandler(context: Context, views: RemoteViews) {
        val launchIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pi = PendingIntent.getActivity(
            context,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or pendingIntentImmutableFlag()
        )
        views.setOnClickPendingIntent(R.id.widget_root, pi)

        val refreshIntent = Intent(context, PricingWidgetProvider::class.java).apply {
            action = ACTION_MANUAL_REFRESH
        }
        val refreshPi = PendingIntent.getBroadcast(
            context,
            1,
            refreshIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or pendingIntentImmutableFlag()
        )
        views.setOnClickPendingIntent(R.id.widget_refresh, refreshPi)
    }

    private fun renderRefreshing(
        context: Context,
        mgr: AppWidgetManager,
        widgetId: Int
    ) {
        val views = RemoteViews(context.packageName, R.layout.widget_pricing)
        views.setTextViewText(R.id.widget_summary, "Refreshing…")
        attachClickHandler(context, views)
        mgr.partiallyUpdateAppWidget(widgetId, views)
    }

    private fun scheduleNext(context: Context) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pi = autoUpdatePendingIntent(context)
        val triggerAt = System.currentTimeMillis() + REFRESH_INTERVAL_MS
        am.set(AlarmManager.RTC, triggerAt, pi)
    }

    private fun cancelSchedule(context: Context) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        am.cancel(autoUpdatePendingIntent(context))
    }

    private fun autoUpdatePendingIntent(context: Context): PendingIntent {
        val intent = Intent(context, PricingWidgetProvider::class.java).apply {
            action = ACTION_AUTO_UPDATE
        }
        return PendingIntent.getBroadcast(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or pendingIntentImmutableFlag()
        )
    }

    private fun pendingIntentImmutableFlag(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0

    private data class PricePoint(val millisUtc: Long, val price: Double)

    // Retries once on transient network errors (DNS not ready, socket timeout)
    // that commonly happen when the alarm fires before radio/resolver are warm.
    private fun fetchPricesWithRetry(): List<PricePoint> {
        return try {
            fetchPrices()
        } catch (e: UnknownHostException) {
            Thread.sleep(800)
            fetchPrices()
        } catch (e: SocketTimeoutException) {
            fetchPrices()
        }
    }

    private fun fetchPrices(): List<PricePoint> {
        // Two attempts must fit under the goAsync() ~10s budget:
        // 3s + 3s per attempt × 2 + 0.8s sleep ≈ 13s worst case; in practice
        // DNS / connect failures return well under the timeout.
        val conn = (URL(API_URL).openConnection() as HttpURLConnection).apply {
            connectTimeout = 3_000
            readTimeout = 3_000
            requestMethod = "GET"
            setRequestProperty("Accept", "application/json")
            setRequestProperty("User-Agent", "ComEdPricingWidget/1.0 (Android)")
        }
        try {
            val code = conn.responseCode
            if (code !in 200..299) {
                Log.w(TAG, "fetchPrices HTTP $code")
                return emptyList()
            }
            conn.inputStream.use { stream ->
                val body = stream.bufferedReader().readText()
                val arr = JSONArray(body)
                val out = ArrayList<PricePoint>(arr.length())
                for (i in 0 until arr.length()) {
                    val obj = arr.getJSONObject(i)
                    val millis = obj.optLong("millisUTC")
                    val priceVal = obj.opt("price")
                    val price = when (priceVal) {
                        is Number -> priceVal.toDouble()
                        is String -> priceVal.toDoubleOrNull() ?: continue
                        else -> continue
                    }
                    out += PricePoint(millis, price)
                }
                return out
            }
        } finally {
            conn.disconnect()
        }
    }

    private fun formatPrice(p: Double): String = String.format("%.2f", p)

    private data class Thresholds(val low: Double, val medium: Double, val high: Double)

    private fun loadThresholds(context: Context): Thresholds {
        val sp = context.getSharedPreferences(FLUTTER_PREFS_NAME, Context.MODE_PRIVATE)
        return Thresholds(
            readFlutterDouble(sp, "low", DEFAULT_LOW),
            readFlutterDouble(sp, "medium", DEFAULT_MEDIUM),
            readFlutterDouble(sp, "high", DEFAULT_HIGH)
        )
    }

    private fun readFlutterDouble(
        sp: SharedPreferences,
        key: String,
        default: Double
    ): Double {
        val raw = sp.getString(FLUTTER_KEY_PREFIX + key, null) ?: return default
        val payload = if (raw.startsWith(FLUTTER_DOUBLE_PREFIX))
            raw.substring(FLUTTER_DOUBLE_PREFIX.length) else raw
        return payload.toDoubleOrNull() ?: default
    }

    private fun renderChart(
        prices: List<Double>,
        width: Int,
        height: Int,
        thresholds: Thresholds
    ): Bitmap {
        // Transparent canvas — the gradient comes from @drawable/widget_background
        // on the FrameLayout. The bitmap only contains the chart line + marker.
        val bmp = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bmp)

        if (prices.size < 2) return bmp

        val line = Paint().apply {
            color = Color.WHITE
            strokeWidth = 3f
            strokeCap = Paint.Cap.ROUND
            strokeJoin = Paint.Join.ROUND
            isAntiAlias = true
            style = Paint.Style.STROKE
        }
        val fill = Paint().apply {
            color = Color.parseColor("#55FFFFFF")
            isAntiAlias = true
            style = Paint.Style.FILL
        }
        val markerOuter = Paint().apply {
            color = Color.WHITE
            isAntiAlias = true
            style = Paint.Style.FILL
        }
        val markerInner = Paint().apply {
            color = Color.parseColor("#1E3A8A")
            isAntiAlias = true
            style = Paint.Style.FILL
        }

        val pad = 4f
        val w = width - 2 * pad
        val h = height - 2 * pad

        val minP = prices.min()
        val maxP = prices.max()
        val range = (maxP - minP).coerceAtLeast(0.1)

        val path = Path()
        val area = Path()
        val points = ArrayList<Pair<Float, Float>>(prices.size)
        prices.forEachIndexed { i, p ->
            val x = pad + i * w / (prices.size - 1)
            val y = pad + (1f - ((p - minP) / range).toFloat()) * h
            points += x to y
            if (i == 0) {
                path.moveTo(x, y)
                area.moveTo(x, pad + h)
                area.lineTo(x, y)
            } else {
                path.lineTo(x, y)
                area.lineTo(x, y)
            }
            if (i == prices.size - 1) {
                area.lineTo(x, pad + h)
                area.close()
            }
        }
        canvas.drawPath(area, fill)
        canvas.drawPath(path, line)

        // Threshold reference lines — only drawn when the price line actually
        // crosses (or touches) the threshold within the visible window. This
        // keeps the existing min/max-fit scale intact and stays out of the way
        // when prices stay in a single band.
        val thresholdPaint = Paint().apply {
            strokeWidth = 1.5f
            isAntiAlias = true
            style = Paint.Style.STROKE
            pathEffect = DashPathEffect(floatArrayOf(8f, 6f), 0f)
        }
        listOf(
            thresholds.low to COLOR_THRESHOLD_LOW,
            thresholds.medium to COLOR_THRESHOLD_MEDIUM,
            thresholds.high to COLOR_THRESHOLD_HIGH
        ).forEach { (t, c) ->
            if (t in minP..maxP) {
                val y = pad + (1f - ((t - minP) / range).toFloat()) * h
                thresholdPaint.color = c
                canvas.drawLine(pad, y, pad + w, y, thresholdPaint)
            }
        }

        // Marker on latest data point
        val (lx, ly) = points.last()
        canvas.drawCircle(lx, ly, 6f, markerOuter)
        canvas.drawCircle(lx, ly, 3f, markerInner)

        return bmp
    }
}
