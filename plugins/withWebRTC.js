const { withInfoPlist, AndroidConfig, createRunOncePlugin } = require('expo/config-plugins');

const CAMERA_USAGE = 'Allow $(PRODUCT_NAME) to access your camera for video calls';
const MICROPHONE_USAGE = 'Allow $(PRODUCT_NAME) to access your microphone for calls';

function withWebRTCPermissionsIOS(config) {
  return withInfoPlist(config, (config) => {
    config.modResults.NSCameraUsageDescription =
      config.modResults.NSCameraUsageDescription || CAMERA_USAGE;
    config.modResults.NSMicrophoneUsageDescription =
      config.modResults.NSMicrophoneUsageDescription || MICROPHONE_USAGE;
    return config;
  });
}

function withWebRTCBitcodeDisabled(config) {
  if (!config.ios) config.ios = {};
  config.ios.bitcode = false;
  return config;
}

function withWebRTCAndroid(config) {
  return AndroidConfig.Permissions.withPermissions(config, [
    'android.permission.ACCESS_NETWORK_STATE',
    'android.permission.CAMERA',
    'android.permission.INTERNET',
    'android.permission.MODIFY_AUDIO_SETTINGS',
    'android.permission.RECORD_AUDIO',
    'android.permission.SYSTEM_ALERT_WINDOW',
    'android.permission.WAKE_LOCK',
    'android.permission.BLUETOOTH',
  ]);
}

const withWebRTC = (config) => {
  config = withWebRTCPermissionsIOS(config);
  config = withWebRTCBitcodeDisabled(config);
  config = withWebRTCAndroid(config);
  return config;
};

module.exports = createRunOncePlugin(withWebRTC, 'local-react-native-webrtc', '1.0.0');
