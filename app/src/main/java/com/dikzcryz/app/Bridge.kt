package com.dikzcryz.app

import android.app.Activity
import android.content.Intent
import android.media.audiofx.AudioEffect
import android.net.Uri
import android.provider.Settings
import android.webkit.JavascriptInterface
import org.json.JSONObject

/** Jembatan JS -> Android. Dipanggil dari web sebagai `Native.xxx()`. */
class Bridge(private val a: Activity) {
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

    @JavascriptInterface fun exitApp() { a.runOnUiThread { a.finish() } }
}
