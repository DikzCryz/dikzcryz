package com.dikzcryz.app

import android.content.Context
import android.content.SharedPreferences
import android.media.audiofx.BassBoost
import android.media.audiofx.Equalizer
import android.media.audiofx.LoudnessEnhancer
import android.media.audiofx.Virtualizer
import org.json.JSONArray
import org.json.JSONObject

/** Efek audio global (session 0) supaya berlaku ke YouTube dan aplikasi musik lain. */
object EqEngine {
    private var started = false
    private var eq: Equalizer? = null
    private var bass: BassBoost? = null
    private var virt: Virtualizer? = null
    private var loud: LoudnessEnhancer? = null
    private lateinit var p: SharedPreferences

    private inline fun safe(block: () -> Unit) {
        try { block() } catch (_: Throwable) { }
    }

    @Synchronized
    fun start(c: Context) {
        p = c.applicationContext.getSharedPreferences("eq", Context.MODE_PRIVATE)
        if (started) return
        started = true
        eq = try { Equalizer(0, 0) } catch (_: Throwable) { null }
        bass = try { BassBoost(0, 0) } catch (_: Throwable) { null }
        virt = try { Virtualizer(0, 0) } catch (_: Throwable) { null }
        loud = try { LoudnessEnhancer(0) } catch (_: Throwable) { null }
        restore()
    }

    @Synchronized
    fun release() {
        safe { eq?.release() }
        safe { bass?.release() }
        safe { virt?.release() }
        safe { loud?.release() }
        eq = null; bass = null; virt = null; loud = null
        started = false
    }

    private fun restore() {
        eq?.let { e ->
            safe {
                for (i in 0 until e.numberOfBands.toInt()) {
                    if (p.contains("b$i")) e.setBandLevel(i.toShort(), p.getInt("b$i", 0).toShort())
                }
            }
        }
        safe { bass?.let { if (it.strengthSupported) it.setStrength(p.getInt("bass", 0).toShort()) } }
        safe { virt?.let { if (it.strengthSupported) it.setStrength(p.getInt("virt", 0).toShort()) } }
        safe { loud?.setTargetGain(p.getInt("loud", 0)) }
        applyEnabled(p.getBoolean("on", false))
    }

    private fun applyEnabled(on: Boolean) {
        safe { eq?.setEnabled(on) }
        safe { bass?.setEnabled(on) }
        safe { virt?.setEnabled(on) }
        safe { loud?.setEnabled(on) }
    }

    fun setEnabled(on: Boolean) {
        p.edit().putBoolean("on", on).apply()
        applyEnabled(on)
    }

    fun setBand(i: Int, level: Int) {
        val e = eq ?: return
        safe {
            val r = e.bandLevelRange
            val v = level.coerceIn(r[0].toInt(), r[1].toInt())
            e.setBandLevel(i.toShort(), v.toShort())
            p.edit().putInt("b$i", v).putInt("preset", -1).apply()
        }
    }

    fun setPreset(i: Int) {
        val e = eq ?: return
        safe {
            e.usePreset(i.toShort())
            val ed = p.edit().putInt("preset", i)
            for (b in 0 until e.numberOfBands.toInt()) ed.putInt("b$b", e.getBandLevel(b.toShort()).toInt())
            ed.apply()
        }
    }

    fun setBass(v: Int) {
        safe { bass?.setStrength(v.coerceIn(0, 1000).toShort()) }
        p.edit().putInt("bass", v.coerceIn(0, 1000)).apply()
    }

    fun setVirt(v: Int) {
        safe { virt?.setStrength(v.coerceIn(0, 1000).toShort()) }
        p.edit().putInt("virt", v.coerceIn(0, 1000)).apply()
    }

    fun setLoud(v: Int) {
        safe { loud?.setTargetGain(v.coerceIn(0, 1000)) }
        p.edit().putInt("loud", v.coerceIn(0, 1000)).apply()
    }

    fun state(): JSONObject {
        val o = JSONObject()
        val e = eq
        o.put("ok", e != null)
        o.put("on", p.getBoolean("on", false))
        safe {
            if (e != null) {
                val r = e.bandLevelRange
                o.put("min", r[0].toInt())
                o.put("max", r[1].toInt())
                val bands = JSONArray()
                for (i in 0 until e.numberOfBands.toInt()) {
                    bands.put(
                        JSONObject()
                            .put("hz", e.getCenterFreq(i.toShort()) / 1000)
                            .put("lv", e.getBandLevel(i.toShort()).toInt())
                    )
                }
                o.put("bands", bands)
                val pr = JSONArray()
                for (i in 0 until e.numberOfPresets.toInt()) pr.put(e.getPresetName(i.toShort()))
                o.put("presets", pr)
                o.put("preset", p.getInt("preset", -1))
            }
        }
        o.put("bassOk", bass?.strengthSupported == true)
        o.put("virtOk", virt?.strengthSupported == true)
        o.put("loudOk", loud != null)
        o.put("bass", p.getInt("bass", 0))
        o.put("virt", p.getInt("virt", 0))
        o.put("loud", p.getInt("loud", 0))
        return o
    }
}
