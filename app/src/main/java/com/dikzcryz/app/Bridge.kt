package com.dikzcryz.app

import android.app.Activity
import android.content.Intent
import android.content.pm.ActivityInfo
import android.media.audiofx.AudioEffect
import android.net.Uri
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/** Jembatan JS -> Android. Dipanggil dari web sebagai `Native.xxx()`. */
class Bridge(private val a: Activity, private val web: WebView) {
    @JavascriptInterface
    fun config(): String = JSONObject()
        .put("yt", BuildConfig.YT_API_KEY)
        .put("sbUrl", BuildConfig.SUPABASE_URL)
        .put("sbKey", BuildConfig.SUPABASE_ANON_KEY)
        .toString()

    /** ID perangkat yang stabil (di-hash), dipakai untuk membatasi jumlah perangkat per token. */
    @JavascriptInterface
    fun deviceId(): String {
        val raw = Settings.Secure.getString(a.contentResolver, Settings.Secure.ANDROID_ID) ?: "unknown"
        val md = java.security.MessageDigest.getInstance("SHA-256").digest(("dikzcryz:" + raw).toByteArray())
        return md.joinToString("") { "%02x".format(it) }.take(32)
    }

    @JavascriptInterface fun eqState(): String = EqEngine.state().toString()

    @JavascriptInterface
    fun eqEnable(on: Boolean): String { EqEngine.setEnabled(on); return EqEngine.state().toString() }

    @JavascriptInterface fun eqBand(i: Int, level: Int): String { EqEngine.setBand(i, level); return "1" }

    @JavascriptInterface
    fun eqPreset(i: Int): String { EqEngine.setPreset(i); return EqEngine.state().toString() }

    @JavascriptInterface fun eqBass(v: Int): String { EqEngine.setBass(v); return "1" }
    @JavascriptInterface fun eqVirt(v: Int): String { EqEngine.setVirt(v); return "1" }
    @JavascriptInterface fun eqLoud(v: Int): String { EqEngine.setLoud(v); return "1" }

    @JavascriptInterface
    fun openSystemEq() {
        a.runOnUiThread {
            try {
                a.startActivity(
                    Intent(AudioEffect.ACTION_DISPLAY_AUDIO_EFFECT_CONTROL_PANEL)
                        .putExtra(AudioEffect.EXTRA_AUDIO_SESSION, 0)
                        .putExtra(AudioEffect.EXTRA_CONTENT_TYPE, AudioEffect.CONTENT_TYPE_MUSIC)
                )
            } catch (_: Exception) { }
        }
    }

    @JavascriptInterface
    fun openUrl(u: String) {
        if (!(u.startsWith("https://") || u.startsWith("http://"))) return
        a.runOnUiThread {
            try { a.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(u))) } catch (_: Exception) { }
        }
    }

    @JavascriptInterface
    fun share(text: String) {
        a.runOnUiThread {
            try {
                val i = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
                a.startActivity(Intent.createChooser(i, "Bagikan"))
            } catch (_: Exception) { }
        }
    }

    /** Layar penuh: putar ke landscape dan sembunyikan bilah sistem. */
    @JavascriptInterface
    fun setFullscreen(on: Boolean) {
        a.runOnUiThread {
            a.requestedOrientation =
                if (on) ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE else ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            val c = WindowCompat.getInsetsController(a.window, a.window.decorView)
            if (on) {
                c.hide(WindowInsetsCompat.Type.systemBars())
                c.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            } else {
                c.show(WindowInsetsCompat.Type.systemBars())
            }
        }
    }

    /** Saran pencarian (layanan tidak resmi). Hasil dikirim balik ke JS lewat window.__sug(id, daftar). */
    @JavascriptInterface
    fun suggest(q: String, id: String) {
        Thread {
            var out = "[]"
            try {
                val u = URL("https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&hl=id&q=" + URLEncoder.encode(q, "UTF-8"))
                val c = u.openConnection() as HttpURLConnection
                c.connectTimeout = 4000
                c.readTimeout = 4000
                c.setRequestProperty("User-Agent", "Mozilla/5.0")
                val body = c.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
                out = JSONArray(body).getJSONArray(1).toString()
            } catch (_: Exception) { }
            val js = "window.__sug && window.__sug(" + JSONObject.quote(id) + "," + out + ")"
            a.runOnUiThread { web.evaluateJavascript(js, null) }
        }.start()
    }

    @JavascriptInterface fun exitApp() { a.runOnUiThread { a.finish() } }
}
