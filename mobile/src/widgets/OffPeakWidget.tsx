import { FlexWidget, TextWidget } from "react-native-android-widget";
import type { WidgetPrice } from "./widgetData";

// borderRadius 0 + full-bleed background: on Android 12+ the launcher applies
// its OWN rounded mask. Setting our own radius fights that mask and produces bad
// edges (worst at the bottom) — Skyfield hit the same thing. Let the launcher
// round it.
const GRADIENT = { from: "#16223c", to: "#0b1220", orientation: "TOP_BOTTOM" } as const;
const FG = "#e8edf6";
const DIM = "#93a0b8";

/** 20%-alpha tint of an #RRGGBB color (AARRGGBB). */
function tint(color: string): `#${string}` {
  return `#33${color.slice(1)}` as `#${string}`;
}

// No React fragments in a widget tree — Fragment is a Symbol and blanks the
// whole widget. Use FlexWidget wrappers.
export function OffPeakWidget({ data }: { data: WidgetPrice | null }) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundGradient: GRADIENT,
        borderRadius: 0,
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <FlexWidget
        style={{
          width: "match_parent",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <TextWidget text="OffPeak" style={{ fontSize: 13, fontWeight: "700", color: FG }} />
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
          <TextWidget text="⟳" style={{ fontSize: 19, color: FG }} />
        </FlexWidget>
      </FlexWidget>

      {data ? (
        <FlexWidget style={{ width: "match_parent", flexDirection: "column", flexGap: 8 }}>
          <TextWidget
            text={data.price}
            style={{ fontSize: 42, fontWeight: "700", color: data.color as `#${string}` }}
          />
          <FlexWidget style={{ flexDirection: "row" }}>
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
          </FlexWidget>
        </FlexWidget>
      ) : (
        <FlexWidget style={{ flexDirection: "column", flexGap: 2 }}>
          <TextWidget text="—" style={{ fontSize: 36, fontWeight: "700", color: DIM }} />
          <TextWidget text="Open the app to load" style={{ fontSize: 12, color: DIM }} />
        </FlexWidget>
      )}

      {data ? (
        <TextWidget
          text={`avg ${data.hourAvg} · ${data.updated}`}
          maxLines={1}
          style={{ fontSize: 11, color: DIM }}
        />
      ) : (
        <TextWidget text="" style={{ fontSize: 1, color: DIM }} />
      )}
    </FlexWidget>
  );
}
