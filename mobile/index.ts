import { registerRootComponent } from "expo";
import { Platform } from "react-native";
import { registerWidgetTaskHandler } from "react-native-android-widget";
import App from "./App";
import { widgetTaskHandler } from "./src/widgets/widgetTaskHandler";
// Imported for side effect: defines the background price-alert task at module
// scope so it exists in headless contexts too.
import "./src/tasks/priceAlertTask";

if (Platform.OS === "android") {
  registerWidgetTaskHandler(widgetTaskHandler);
}

registerRootComponent(App);
