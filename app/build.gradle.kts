import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Nilai rahasia dibaca dari environment (GitHub Secrets) atau keys.properties, TIDAK ditulis di kode.
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

val hasKeystore = !System.getenv("KEYSTORE_FILE").isNullOrBlank()

android {
    namespace = "com.dikzcryz.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.dikzcryz.app"
        minSdk = 26
        targetSdk = 34
        versionCode = 5
        versionName = "5.0"
        buildConfigField("String", "YT_API_KEY", "\"${secret("YT_API_KEY")}\"")
        buildConfigField("String", "SUPABASE_URL", "\"${secret("SUPABASE_URL")}\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"${secret("SUPABASE_ANON_KEY")}\"")
    }

    signingConfigs {
        create("rel") {
            if (hasKeystore) {
                storeFile = file(System.getenv("KEYSTORE_FILE"))
                storePassword = System.getenv("KEYSTORE_PASSWORD")
                keyAlias = System.getenv("KEY_ALIAS")
                keyPassword = System.getenv("KEY_PASSWORD")
            }
        }
    }

    buildFeatures { buildConfig = true }
    buildTypes {
        release {
            isMinifyEnabled = false
            // Kunci tetap (keystore sendiri) kalau tersedia; kalau tidak, pakai debug key.
            signingConfig = if (hasKeystore) signingConfigs.getByName("rel") else signingConfigs.getByName("debug")
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
