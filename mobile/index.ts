import { registerRootComponent } from "expo";
import App from "./App";
// Imported for side effect: defines the background price-alert task at module
// scope so it exists in headless contexts too.
import "./src/tasks/priceAlertTask";
// Headless fetch task the native widget's ⟳ WorkManager worker runs (the app
// may be closed). Must be registered at module load so it's available headless.
import { registerWidgetSyncTask } from "./src/widgets/widgetSync";

registerWidgetSyncTask();

registerRootComponent(App);
