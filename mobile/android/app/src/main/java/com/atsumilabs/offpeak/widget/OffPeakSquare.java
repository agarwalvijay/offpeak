package com.atsumilabs.offpeak.widget;

import com.atsumilabs.offpeak.R;

/**
 * 3×2 "square" widget: same content + bind logic as the banner (OffPeakPrice),
 * just a roomier layout — big price up top and a tall last-hour trend chart
 * below. Reuses the shared store, refresh wiring, and bar renderer.
 */
public class OffPeakSquare extends OffPeakPrice {
    @Override
    protected int layoutId() {
        return R.layout.widget_offpeak_square;
    }

    /** Narrow the chart to ~the last hour (12× 5-min) — it's the "last hour"
     *  view, and chunkier bars read better in the taller square chart area. */
    @Override
    protected int maxBars() {
        return 12;
    }
}
