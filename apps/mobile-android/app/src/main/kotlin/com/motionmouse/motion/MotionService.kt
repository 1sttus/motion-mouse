package com.motionmouse.motion

import android.app.Service
import android.content.Intent
import android.os.Binder
import android.os.IBinder
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*

class MotionService : Service() {
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private lateinit var sensorProvider: SensorProvider
    private val motionEngine = MotionEngine()
    
    private val _packets = MutableSharedFlow<MotionPacket>(extraBufferCapacity = 64)
    val packets: SharedFlow<MotionPacket> = _packets.asSharedFlow()

    private var collectionJob: Job? = null

    inner class LocalBinder : Binder() {
        fun getService(): MotionService = this@MotionService
    }

    private val binder = LocalBinder()

    override fun onCreate() {
        super.onCreate()
        sensorProvider = AndroidSensorProvider(this)
        startCollecting()
    }

    private fun startCollecting() {
        collectionJob?.cancel()
        collectionJob = serviceScope.launch {
            sensorProvider.samples
                .mapNotNull { sample -> 
                    motionEngine.process(sample) 
                }
                .collect { packet ->
                    _packets.emit(packet)
                }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
    }

    // Engine control methods
    fun calibrate(): Boolean = motionEngine.calibrate()
    fun recenter(): Boolean = motionEngine.recenter()
    fun pause() = motionEngine.pause()
    fun resume() = motionEngine.resume()
    
    fun updateConfig(config: MotionConfig) {
        // In a real app, we might want to recreate the engine or update it
        // For simplicity, we assume MotionEngine can take a new config if we added a setter
        // or we just replace the instance if needed.
    }
}
