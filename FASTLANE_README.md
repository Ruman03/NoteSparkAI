Fastlane setup (Android)

This project plans to use Fastlane for signed builds and Play Console uploads.

Steps to initialize on your machine:

1. Install Ruby and Bundler, then install gems:
   - bundle install
2. Initialize Fastlane for Android:
   - cd android && fastlane init
3. Create lanes in android/fastlane/Fastfile, e.g.:
   - lane :assemble_release do
       gradle(task: "assembleRelease")
     end
   - lane :upload_internal do
       upload_to_play_store(track: "internal")
     end
4. Configure service account JSON and Play API access.
5. Add signing configs (keystore) and Gradle properties in CI via secrets.

CI integration:
- Add a job to build AAB via `./gradlew bundleRelease` and sign via Play/App Signing.
