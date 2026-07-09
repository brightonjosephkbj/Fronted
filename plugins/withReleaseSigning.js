const { withAppBuildGradle } = require('@expo/config-plugins');

// Injects a release signingConfig into the freshly-generated android/app/build.gradle
// on every `expo prebuild`. Values come from Gradle properties passed with -P flags
// in CI (see .github/workflows/build-apk.yml), sourced from GitHub secrets so the
// keystore/passwords never live in this repo. Falls back to the default debug
// signing if those properties aren't set (e.g. a local `gradlew assembleRelease`
// run without the CI secrets), so local dev builds still work.
module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes('B24_UPLOAD_STORE_FILE')) {
      contents = contents.replace(
        /signingConfigs\s*\{/,
        `signingConfigs {
        release {
            if (project.hasProperty('B24_UPLOAD_STORE_FILE')) {
                storeFile file(B24_UPLOAD_STORE_FILE)
                storePassword B24_UPLOAD_STORE_PASSWORD
                keyAlias B24_UPLOAD_KEY_ALIAS
                keyPassword B24_UPLOAD_KEY_PASSWORD
            }
        }`
      );

      contents = contents.replace(
        /release\s*\{\s*\n(\s*)signingConfig signingConfigs\.debug/,
        `release {\n$1signingConfig project.hasProperty('B24_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug`
      );
    }

    config.modResults.contents = contents;
    return config;
  });
};
