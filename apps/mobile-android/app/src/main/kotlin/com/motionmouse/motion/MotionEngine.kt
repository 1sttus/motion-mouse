package com.motionmouse.motion

import android.view.Surface
import kotlin.math.*

enum class MotionMode {
    RELATIVE, ORIENTATION
}

data class MotionConfig(
    val mode: MotionMode = MotionMode.RELATIVE,
    val sensitivity: Float = 900f,
    val deadZoneRadians: Float = 0.0025f,
    val smoothingTimeConstantSeconds: Float = 0.035f,
    val acceleration: Float = 0.35f,
    val maximumVelocity: Float = 2500f,
    val minimumMovement: Float = 0.02f,
    val maximumDelta: Float = 100f,
    val complementaryGain: Float = 0.02f,
    val maxSampleIntervalSeconds: Float = 0.1f
)

data class Vector3(val x: Float, val y: Float, val z: Float)
data class Attitude(val yaw: Float, val pitch: Float, val roll: Float)
data class Vector2(val x: Float, val y: Float)

data class MotionCapabilities(
    val fusedAttitude: Boolean,
    val gyroscope: Boolean,
    val accelerometer: Boolean
)

data class MotionSample(
    val timestampMs: Long,
    val gyro: Vector3? = null,
    val acceleration: Vector3? = null,
    val attitude: Attitude? = null,
    val displayOrientation: Int = Surface.ROTATION_0,
    val capabilities: MotionCapabilities
)

data class MotionPacket(
    val deltaX: Float,
    val deltaY: Float,
    val velocityX: Float,
    val velocityY: Float,
    val timestampMs: Long,
    val mode: MotionMode
)

class MotionEngine(private var config: MotionConfig = MotionConfig()) {
    private var isPaused = false
    private var strategy: String? = null
    private var lastTimestampMs: Long? = null
    private var lastSampleTimestampMs: Long? = null
    private var attitude: Attitude? = null
    private var previousAttitude: Attitude? = null
    private var baseline: Attitude? = null
    private var smooth = Vector2(0f, 0f)

    fun getConfig() = config
    
    fun setSensitivityFactor(factor: Float) {
        config = config.copy(sensitivity = 900f * factor)
    }

    fun getState() = mapOf(
        "paused" to isPaused,
        "strategy" to strategy,
        "calibrated" to (baseline != null),
        "lastTimestampMs" to lastTimestampMs
    )

    fun pause() {
        isPaused = true
        resetDynamics()
    }

    fun resume() {
        isPaused = false
        baseline = attitude?.copy() ?: baseline
        resetDynamics()
    }

    fun calibrate(): Boolean {
        val currentAttitude = attitude ?: return false
        baseline = currentAttitude.copy()
        resetDynamics()
        return true
    }

    fun recenter(): Boolean = calibrate()

    private fun resetDynamics() {
        previousAttitude = attitude?.copy() ?: previousAttitude
        smooth = Vector2(0f, 0f)
    }

    fun process(sample: MotionSample): MotionPacket? {
        if (lastTimestampMs != null && sample.timestampMs <= lastTimestampMs!!) return null
        
        val currentStrategy = selectStrategy(sample.capabilities)
        strategy = currentStrategy
        lastTimestampMs = sample.timestampMs
        
        if (currentStrategy == "unavailable") return null
        
        val dt = if (lastSampleTimestampMs == null) 0f 
                 else min((sample.timestampMs - lastSampleTimestampMs!!).toFloat() / 1000f, config.maxSampleIntervalSeconds)
        
        val estimatedAttitude = estimateAttitude(sample, attitude, dt, currentStrategy, config.complementaryGain)
        attitude = estimatedAttitude
        lastSampleTimestampMs = sample.timestampMs
        
        if (estimatedAttitude == null || isPaused) {
            resetDynamics()
            return null
        }
        
        if (baseline == null) baseline = estimatedAttitude
        
        if (previousAttitude == null) {
            previousAttitude = estimatedAttitude
            return MotionPacket(0f, 0f, 0f, 0f, sample.timestampMs, config.mode)
        }
        
        val raw = if (config.mode == MotionMode.ORIENTATION) {
            attitudeDelta(baseline!!, estimatedAttitude)
        } else {
            attitudeDelta(previousAttitude!!, estimatedAttitude)
        }
        
        previousAttitude = estimatedAttitude
        
        val screen = orientVector(raw.x, raw.y, sample.displayOrientation)
        val output = shapeMotion(screen.x, screen.y, dt, config, smooth)
        smooth = output.smooth
        
        return MotionPacket(output.deltaX, output.deltaY, output.velocityX, output.velocityY, sample.timestampMs, config.mode)
    }

    private fun selectStrategy(capabilities: MotionCapabilities): String {
        return when {
            capabilities.fusedAttitude -> "fused-attitude"
            capabilities.gyroscope && capabilities.accelerometer -> "complementary-filter"
            capabilities.gyroscope -> "gyro-only"
            else -> "unavailable"
        }
    }

    private fun estimateAttitude(sample: MotionSample, previous: Attitude?, dt: Float, strategy: String, gain: Float): Attitude? {
        if (strategy == "fused-attitude") return sample.attitude
        
        if (previous == null) {
            return sample.acceleration?.let { attitudeFromGravity(it) } ?: Attitude(0f, 0f, 0f)
        }
        
        val gyro = sample.gyro ?: return previous
        val integrated = Attitude(
            yaw = wrap(previous.yaw + gyro.z * dt),
            pitch = wrap(previous.pitch + gyro.x * dt),
            roll = wrap(previous.roll + gyro.y * dt)
        )
        
        if (strategy != "complementary-filter" || sample.acceleration == null) return integrated
        
        val gravity = attitudeFromGravity(sample.acceleration)
        return Attitude(
            yaw = integrated.yaw,
            pitch = blendAngle(integrated.pitch, gravity.pitch, gain),
            roll = blendAngle(integrated.roll, gravity.roll, gain)
        )
    }

    private fun attitudeFromGravity(g: Vector3): Attitude {
        val pitch = atan2(-g.x, sqrt(g.y * g.y + g.z * g.z))
        val roll = atan2(g.y, g.z)
        return Attitude(0f, pitch, roll)
    }

    private fun attitudeDelta(from: Attitude, to: Attitude): Vector2 {
        return Vector2(wrap(to.yaw - from.yaw), wrap(to.pitch - from.pitch))
    }

    private fun wrap(value: Float): Float {
        val tau = (PI * 2).toFloat()
        return ((value + PI.toFloat()) % tau + tau) % tau - PI.toFloat()
    }

    private fun blendAngle(from: Float, to: Float, gain: Float): Float {
        return wrap(from + wrap(to - from) * gain)
    }

    private fun orientVector(x: Float, y: Float, rotation: Int): Vector2 {
        return when (rotation) {
            Surface.ROTATION_90 -> Vector2(y, -x)
            Surface.ROTATION_270 -> Vector2(-y, x)
            Surface.ROTATION_180 -> Vector2(-x, -y)
            else -> Vector2(x, y)
        }
    }

    private data class ShapeResult(
        val deltaX: Float,
        val deltaY: Float,
        val velocityX: Float,
        val velocityY: Float,
        val smooth: Vector2
    )

    private fun shapeMotion(x: Float, y: Float, dt: Float, config: MotionConfig, previousSmooth: Vector2): ShapeResult {
        val magnitude = hypot(x.toDouble(), y.toDouble()).toFloat()
        if (magnitude <= config.deadZoneRadians || dt <= 0f) {
            return ShapeResult(0f, 0f, 0f, 0f, Vector2(0f, 0f))
        }
        
        val gain = config.sensitivity * (1f + config.acceleration * min((magnitude / dt) / 4f, 1f))
        val targetX = x * gain
        val targetY = y * gain
        
        val alpha = if (config.smoothingTimeConstantSeconds == 0f) 1f 
                    else 1f - exp(-dt / config.smoothingTimeConstantSeconds).toFloat()
        
        val smoothX = previousSmooth.x + (targetX - previousSmooth.x) * alpha
        val smoothY = previousSmooth.y + (targetY - previousSmooth.y) * alpha
        val smooth = Vector2(smoothX, smoothY)
        
        val speed = hypot(smoothX.toDouble(), smoothY.toDouble()).toFloat() / dt
        val scale = if (speed > config.maximumVelocity) config.maximumVelocity / speed else 1f
        
        val deltaX = (smoothX * scale).coerceIn(-config.maximumDelta, config.maximumDelta)
        val deltaY = (smoothY * scale).coerceIn(-config.maximumDelta, config.maximumDelta)
        
        if (hypot(deltaX.toDouble(), deltaY.toDouble()).toFloat() < config.minimumMovement) {
            return ShapeResult(0f, 0f, 0f, 0f, Vector2(0f, 0f))
        }
        
        return ShapeResult(deltaX, deltaY, deltaX / dt, deltaY / dt, smooth)
    }
}
