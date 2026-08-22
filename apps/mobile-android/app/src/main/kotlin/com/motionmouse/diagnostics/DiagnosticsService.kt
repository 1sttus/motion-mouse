package com.motionmouse.diagnostics

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Debug
import android.util.Log
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Data class representing the collected diagnostic metrics.
 */
data class DiagnosticsMetrics(
    val batteryLevel: Int = -1,
    val isCharging: Boolean = false,
    val cpuUsageEstimate: Double = 0.0,
    val timestamp: Long = System.currentTimeMillis()
)

/**
 * DiagnosticsService monitors system health metrics such as battery level and CPU usage.
 * It provides a Flow of updates and logs periodic summaries.
 */
object DiagnosticsService {
    private const val TAG = "DiagnosticsService"
    private const val MONITOR_INTERVAL_MS = 10_000L // 10 seconds

    private val _metrics = MutableStateFlow(DiagnosticsMetrics())
    val metrics: StateFlow<DiagnosticsMetrics> = _metrics.asStateFlow()

    private var serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var monitorJob: Job? = null
    
    private var lastCpuTime: Long = 0
    private var lastTimeNanos: Long = 0

    /**
     * Starts the diagnostic monitoring process.
     */
    fun start(context: Context) {
        if (monitorJob?.isActive == true) return

        Log.d(TAG, "Starting DiagnosticsService")
        
        // Reset CPU tracking
        lastCpuTime = Debug.threadCpuTimeNanos()
        lastTimeNanos = System.nanoTime()

        monitorJob = serviceScope.launch {
            while (isActive) {
                val currentMetrics = collectMetrics(context)
                _metrics.value = currentMetrics
                
                logSummary(currentMetrics)
                
                delay(MONITOR_INTERVAL_MS)
            }
        }
    }

    /**
     * Stops the diagnostic monitoring process.
     */
    fun stop() {
        Log.d(TAG, "Stopping DiagnosticsService")
        monitorJob?.cancel()
        monitorJob = null
    }

    private fun collectMetrics(context: Context): DiagnosticsMetrics {
        val batteryIntent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        
        val level = batteryIntent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = batteryIntent?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        val batteryPct = if (level != -1 && scale != -1) (level / scale.toDouble() * 100).toInt() else -1
        
        val status = batteryIntent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING || 
                         status == BatteryManager.BATTERY_STATUS_FULL

        // Estimate CPU usage using threadCpuTimeNanos as a proxy for "Active" monitoring
        // Note: This is a rough estimate and primarily tracks the current thread's usage.
        val currentCpuTime = Debug.threadCpuTimeNanos()
        val currentTimeNanos = System.nanoTime()
        
        val cpuDiff = currentCpuTime - lastCpuTime
        val timeDiff = currentTimeNanos - lastTimeNanos
        
        val cpuUsage = if (timeDiff > 0) {
            (cpuDiff.toDouble() / timeDiff.toDouble()) * 100.0
        } else {
            0.0
        }
        
        lastCpuTime = currentCpuTime
        lastTimeNanos = currentTimeNanos

        return DiagnosticsMetrics(
            batteryLevel = batteryPct,
            isCharging = isCharging,
            cpuUsageEstimate = cpuUsage,
            timestamp = System.currentTimeMillis()
        )
    }

    private fun logSummary(metrics: DiagnosticsMetrics) {
        Log.i(TAG, "Diagnostics Summary: Battery: ${metrics.batteryLevel}% (Charging: ${metrics.isCharging}), CPU Estimate: ${"%.2f".format(metrics.cpuUsageEstimate)}%")
    }
}
