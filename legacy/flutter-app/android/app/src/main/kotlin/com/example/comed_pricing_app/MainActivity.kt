package com.example.comed_pricing_app

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Force the home-screen widget to re-render with the current APK's
        // layout. Without this, an existing widget instance can keep showing
        // the old (possibly broken) cached layout after an app update.
        val mgr = AppWidgetManager.getInstance(applicationContext)
        val ids = mgr.getAppWidgetIds(
            ComponentName(applicationContext, PricingWidgetProvider::class.java)
        )
        if (ids.isNotEmpty()) {
            val intent = Intent(applicationContext, PricingWidgetProvider::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            }
            applicationContext.sendBroadcast(intent)
        }
    }
}
