package com.atsumilabs.offpeak.widget;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.io.File;
import java.io.FileOutputStream;

/**
 * Lets JS repaint the native widget the instant it writes fresh data to the
 * store — instead of waiting on Android's unreliable ~30-min
 * updatePeriodMillis. Called after every store write (app-open publish and
 * background sync).
 */
public class WidgetBridgeModule extends ReactContextBaseJavaModule {
    public WidgetBridgeModule(ReactApplicationContext context) {
        super(context);
    }

    @NonNull
    @Override
    public String getName() {
        return "WidgetBridge";
    }

    /** Repaint every widget shape from the store now. */
    @ReactMethod
    public void requestUpdate() {
        BaseOffPeakWidget.updateAll(getReactApplicationContext());
    }

    /**
     * Persist the widget store JSON to getFilesDir()/widget_store.json — the file
     * the native provider reads. JS owns the read-modify-write (newest-wins) and
     * hands us the full document. Works in headless contexts (no expo-file-system
     * needed). Repaint is a separate requestUpdate() call.
     */
    @ReactMethod
    public void writeStore(String json) {
        try {
            File f = new File(getReactApplicationContext().getFilesDir(), "widget_store.json");
            FileOutputStream fos = new FileOutputStream(f);
            fos.write(json.getBytes("UTF-8"));
            fos.close();
        } catch (Exception e) {
            // non-fatal — the widget keeps its last-rendered values
        }
    }
}

