package com.dikzcryz.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.net.Uri
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader

class MainActivity : AppCompatActivity() {
    private lateinit var web: WebView

    private var fileCb: ValueCallback<Array<Uri>>? = null

    private val picker =
        registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
            fileCb?.onReceiveValue(if (uri != null) arrayOf(uri) else null)
            fileCb = null
        }

    private val notifPerm =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { startAudio() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        EqEngine.start(this)

        web = WebView(this)
        setContentView(web)

        // Disajikan lewat https://appassets.androidplatform.net supaya embed YouTube punya origin https yang valid.
        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            allowContentAccess = false
        }
        web.addJavascriptInterface(Bridge(this, web), "Native")
        // Tanpa ini, <input type="file"> di WebView tidak melakukan apa-apa (foto profil tidak bisa dipilih).
        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView?,
                callback: ValueCallback<Array<Uri>>?,
                params: WebChromeClient.FileChooserParams?
            ): Boolean {
                if (callback == null) return false
                fileCb?.onReceiveValue(null)
                fileCb = callback
                return try {
                    picker.launch("image/*")
                    true
                } catch (_: Exception) {
                    fileCb = null
                    callback.onReceiveValue(null)
                    false
                }
            }
        }
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest) =
                loader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (!request.isForMainFrame) return false
                if (request.url.host == "appassets.androidplatform.net") return false
                try { startActivity(Intent(Intent.ACTION_VIEW, request.url)) } catch (_: Exception) { }
                return true
            }
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                web.evaluateJavascript("window.__back ? window.__back() : false") { r ->
                    if (r != "true") finish()
                }
            }
        })

        web.loadUrl("https://appassets.androidplatform.net/assets/www/index.html")

        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED
        ) {
            notifPerm.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            startAudio()
        }
    }

    private fun startAudio() {
        try {
            ContextCompat.startForegroundService(this, Intent(this, AudioService::class.java))
        } catch (_: Exception) { }
    }

    // Sengaja TIDAK memanggil web.onPause() supaya YouTube tetap bunyi saat app di background.
    override fun onDestroy() {
        web.destroy()
        super.onDestroy()
    }
}
