import java.util.Properties
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Key dibaca dari environment (GitHub Secrets) atau keys.properties, TIDAK ditulis di kode.
fun secret(name: String): String {
    val env = System.getenv(name)
    if (!env.isNullOrBlank()) return env
    val f = rootProject.file("keys.properties")
    if (f.exists()) {
        val p = Properties()
        f.inputStream().use { p.load(it) }
        return p.getProperty(name, "")
    }
    return ""
}

android {
    namespace = "com.dikzcryz.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.dikzcryz.app"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
        buildConfigField("String", "YT_API_KEY", "\"${secret("YT_API_KEY")}\"")
        buildConfigField("String", "GEMINI_API_KEY", "\"${secret("GEMINI_API_KEY")}\"")
    }
    buildFeatures { buildConfig = true }
    buildTypes {
        release {
            isMinifyEnabled = false
            // Ditandatangani dengan debug key supaya langsung bisa di-install.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.11.0")
}
