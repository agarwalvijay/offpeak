/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: "widget",
  name: "OffPeakWidget",
  // Shares the snapshot the RN app writes via ExtensionStorage (App Group).
  entitlements: {
    "com.apple.security.application-groups": ["group.com.atsumilabs.offpeak"],
  },
};
