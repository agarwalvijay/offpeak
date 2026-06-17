import { FlexWidget, TextWidget } from "react-native-android-widget";
import type { WidgetPrice } from "./widgetData";

// Solid background (NOT a gradient): react-native-android-widget can't express
// a gradient in RemoteViews, so it renders gradient/rounded views to a bitmap
// sized from the OS-reported widget dimensions — which are intermittently stale
// or report the min height on boot/periodic-update, producing the "half
// rendered" widget (a manual refresh re-reads the real size and fixes it). A
// flat backgroundColor is a native RemoteViews fill that always matches the
// laid-out size, so it can't clip.
// borderRadius 0 + full-bleed: on Android 12+ the launcher applies its OWN
// rounded mask; setting our own radius fights it and produces bad edges.
const BG = "#1a2a47";
const FG = "#e8edf6";
const DIM = "#93a0b8";

/** 20%-alpha tint of an #RRGGBB color (AARRGGBB). */
function tint(color: string): `#${string}` {
  return `#33${color.slice(1)}` as `#${string}`;
}

// Thin horizontal banner (default 4×1): one row — price + level on the left,
// avg/updated + refresh on the right. No React fragments in a widget tree.
export function OffPeakWidget({ data }: { data: WidgetPrice | null }) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: BG,
        borderRadius: 0,
        paddingHorizontal: 16,
        paddingVertical: 8,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      {/* Left: price + level */}
      <FlexWidget style={{ flexDirection: "row", alignItems: "center", flexGap: 10 }}>
        {data ? (
          <TextWidget
            text={data.price}
            style={{ fontSize: 30, fontWeight: "700", color: data.color as `#${string}` }}
          />
        ) : (
          <TextWidget text="OffPeak" style={{ fontSize: 16, fontWeight: "700", color: FG }} />
        )}
        {data ? (
          <FlexWidget
            style={{
              backgroundColor: tint(data.color),
              borderRadius: 8,
              paddingHorizontal: 9,
              paddingVertical: 3,
            }}
          >
            <TextWidget
              text={data.level}
              style={{ fontSize: 12, fontWeight: "700", color: data.color as `#${string}` }}
            />
          </FlexWidget>
        ) : (
          <TextWidget text="Open app" style={{ fontSize: 13, color: DIM }} />
        )}
      </FlexWidget>

      {/* Right: meta + refresh */}
      <FlexWidget style={{ flexDirection: "row", alignItems: "center", flexGap: 12 }}>
        {data ? (
          <FlexWidget style={{ flexDirection: "column", alignItems: "flex-end" }}>
            <TextWidget text={`avg ${data.hourAvg}`} maxLines={1} style={{ fontSize: 11, color: DIM }} />
            <TextWidget text={data.updated} maxLines={1} style={{ fontSize: 10, color: DIM }} />
          </FlexWidget>
        ) : (
          <TextWidget text="" style={{ fontSize: 1, color: DIM }} />
        )}
        <FlexWidget
          clickAction="REFRESH"
          style={{
            width: 38,
            height: 38,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 19,
            backgroundColor: "#1e2a44",
          }}
        >
          <TextWidget text="⟳" style={{ fontSize: 18, color: FG }} />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
