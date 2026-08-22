package com.motionmouse.motion

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

object Protocol {
    const val VERSION = 1
    const val MAX_POINTER_DELTA = 1000

    private val json = Json { ignoreUnknownKeys = true }

    @Serializable
    data class Envelope(
        val v: Int = VERSION,
        val kind: String,
        val seq: Long,
        val sentAtMs: Long,
        val sessionId: String? = null,
        val payload: JsonObject
    )

    fun createAuthPacket(token: String, seq: Long): String {
        val payload = buildJsonObject {
            put("token", token)
        }
        return json.encodeToString(
            Envelope(
                kind = "session.auth",
                seq = seq,
                sentAtMs = System.currentTimeMillis(),
                payload = payload
            )
        )
    }

    fun createPointerDeltaPacket(sessionId: String, seq: Long, dx: Int, dy: Int): String {
        val payload = buildJsonObject {
            put("dx", dx)
            put("dy", dy)
        }
        return json.encodeToString(
            Envelope(
                kind = "pointer.delta",
                seq = seq,
                sentAtMs = System.currentTimeMillis(),
                sessionId = sessionId,
                payload = payload
            )
        )
    }

    fun createButtonPacket(sessionId: String, seq: Long, button: String, action: String): String {
        val payload = buildJsonObject {
            put("button", button)
            put("action", action)
        }
        return json.encodeToString(
            Envelope(
                kind = "button",
                seq = seq,
                sentAtMs = System.currentTimeMillis(),
                sessionId = sessionId,
                payload = payload
            )
        )
    }

    fun createScrollPacket(sessionId: String, seq: Long, dx: Int, dy: Int): String {
        val payload = buildJsonObject {
            put("dx", dx)
            put("dy", dy)
        }
        return json.encodeToString(
            Envelope(
                kind = "scroll",
                seq = seq,
                sentAtMs = System.currentTimeMillis(),
                sessionId = sessionId,
                payload = payload
            )
        )
    }

    fun createHeartbeatPacket(sessionId: String, seq: Long): String {
        return json.encodeToString(
            Envelope(
                kind = "session.heartbeat",
                seq = seq,
                sentAtMs = System.currentTimeMillis(),
                sessionId = sessionId,
                payload = buildJsonObject { }
            )
        )
    }

    fun createCalibratePacket(sessionId: String, seq: Long): String {
        return json.encodeToString(
            Envelope(
                kind = "calibrate",
                seq = seq,
                sentAtMs = System.currentTimeMillis(),
                sessionId = sessionId,
                payload = buildJsonObject { }
            )
        )
    }
}
