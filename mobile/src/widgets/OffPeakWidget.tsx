import { FlexWidget, TextWidget } from "react-native-android-widget";
import type { WidgetPrice } from "./widgetData";

const BG = "#0b1220";
const FG = "#e8edf6";
const DIM = "#93a0b8";

// NOTE: no React fragments anywhere in a widget tree — the RemoteViews builder
// calls each element type as a function and Fragment is a Symbol, which blanks
// the whole widget. Use FlexWidget wrappers instead.
export function OffPeakWidget({ data }: { data: WidgetPrice | null }) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: BG,
        borderRadius: 16,
        padding: 14,
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
        <TextWidget text="OffPeak" style={{ fontSize: 12, fontWeight: "700", color: FG }} />
        <FlexWidget clickAction="REFRESH" style={{ padding: 4 }}>
          <TextWidget text="⟳" style={{ fontSize: 14, color: DIM }} />
        </FlexWidget>
      </FlexWidget>

      {data ? (
        <FlexWidget style={{ width: "match_parent", flexDirection: "column" }}>
          <TextWidget
            text={data.price}
            style={{ fontSize: 36, fontWeight: "700", color: data.color as `#${string}` }}
          />
          <TextWidget
            text={`${data.level} · avg ${data.hourAvg}`}
            maxLines={1}
            style={{ fontSize: 12, color: DIM }}
          />
          <TextWidget text={`updated ${data.updated}`} style={{ fontSize: 10, color: DIM }} />
        </FlexWidget>
      ) : (
        <TextWidget text="Tap to open" style={{ fontSize: 12, color: DIM }} />
      )}
    </FlexWidget>
  );
}
