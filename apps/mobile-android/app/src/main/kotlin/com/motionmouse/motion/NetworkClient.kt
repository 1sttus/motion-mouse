package com.motionmouse.motion

import android.util.Log
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import okhttp3.*
import org.json.JSONObject
import java.security.SecureRandom
import java.security.cert.X509Certificate
import java.util.concurrent.TimeUnit
import javax.net.ssl.*

class NetworkClient(
    private val token: String,
    private val serverUrl: String
) {
    private val TAG = "NetworkClient"
    private val client: OkHttpClient = createUnsafeOkHttpClient()
    private var webSocket: WebSocket? = null
    private var seq: Long = 0
    private var sessionId: String? = null

    private val _connectionState = MutableStateFlow(ConnectionState.DISCONNECTED)
    val connectionState: StateFlow<ConnectionState> = _connectionState

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var heartbeatJob: Job? = null
    private var deltaJob: Job? = null

    private var pendingDeltaX = 0
    private var pendingDeltaY = 0

    enum class ConnectionState {
        DISCONNECTED, CONNECTING, CONNECTED, AUTHENTICATED, ERROR
    }

    fun connect() {
        if (_connectionState.value == ConnectionState.CONNECTING || _connectionState.value == ConnectionState.CONNECTED) return

        _connectionState.value = ConnectionState.CONNECTING
        val request = Request.Builder().url(serverUrl).build()
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.d(TAG, "WebSocket Opened")
                _connectionState.value = ConnectionState.CONNECTED
                authenticate()
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                Log.d(TAG, "Message received: $text")
                handleMessage(text)
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                Log.d(TAG, "WebSocket Closing: $reason")
                _connectionState.value = ConnectionState.DISCONNECTED
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "WebSocket Failure: ${t.message}", t)
                _connectionState.value = ConnectionState.ERROR
                cleanup()
            }
        })
    }

    private fun authenticate() {
        val authPacket = Protocol.createAuthPacket(token, seq++)
        webSocket?.send(authPacket)
    }

    private fun handleMessage(text: String) {
        try {
            val json = JSONObject(text)
            val kind = json.optString("kind")
            if (kind == "session.ack") {
                sessionId = json.optString("sessionId")
                _connectionState.value = ConnectionState.AUTHENTICATED
                startHeartbeat()
                startDeltaStream()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing message", e)
        }
    }

    private fun startHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = scope.launch {
            while (isActive) {
                delay(30000) // 30s heartbeat
                sessionId?.let {
                    webSocket?.send(Protocol.createHeartbeatPacket(it, seq++))
                }
            }
        }
    }

    private fun startDeltaStream() {
        deltaJob?.cancel()
        deltaJob = scope.launch {
            while (isActive) {
                delay(16) // ~60Hz
                val dx = synchronized(this@NetworkClient) { 
                    val valX = pendingDeltaX
                    pendingDeltaX = 0
                    valX
                }
                val dy = synchronized(this@NetworkClient) {
                    val valY = pendingDeltaY
                    pendingDeltaY = 0
                    valY
                }

                if (dx != 0 || dy != 0) {
                    sessionId?.let {
                        webSocket?.send(Protocol.createPointerDeltaPacket(it, seq++, dx, dy))
                    }
                }
            }
        }
    }

    fun sendDelta(dx: Int, dy: Int) {
        synchronized(this) {
            pendingDeltaX += dx
            pendingDeltaY += dy
        }
    }

    fun sendButton(button: String, action: String) {
        sessionId?.let { id ->
            scope.launch {
                webSocket?.send(Protocol.createButtonPacket(id, seq++, button, action))
            }
        }
    }

    fun sendScroll(dx: Int, dy: Int) {
        sessionId?.let { id ->
            scope.launch {
                webSocket?.send(Protocol.createScrollPacket(id, seq++, dx, dy))
            }
        }
    }

    fun sendCalibrate() {
        sessionId?.let {
            scope.launch {
                webSocket?.send(Protocol.createCalibratePacket(it, seq++))
            }
        }
    }

    fun disconnect() {
        webSocket?.close(1000, "User requested")
        cleanup()
    }

    private fun cleanup() {
        heartbeatJob?.cancel()
        deltaJob?.cancel()
        sessionId = null
        _connectionState.value = ConnectionState.DISCONNECTED
    }

    private fun createUnsafeOkHttpClient(): OkHttpClient {
        try {
            val trustAllCerts = arrayOf<TrustManager>(object : X509TrustManager {
                override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
                override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
                override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf()
            })

            val sslContext = SSLContext.getInstance("SSL")
            sslContext.init(null, trustAllCerts, SecureRandom())
            val sslSocketFactory = sslContext.socketFactory

            return OkHttpClient.Builder()
                .sslSocketFactory(sslSocketFactory, trustAllCerts[0] as X509TrustManager)
                .hostnameVerifier { _, _ -> true }
                .connectTimeout(10, TimeUnit.SECONDS)
                .readTimeout(0, TimeUnit.MILLISECONDS) // For WebSockets
                .build()
        } catch (e: Exception) {
            throw RuntimeException(e)
        }
    }
}
