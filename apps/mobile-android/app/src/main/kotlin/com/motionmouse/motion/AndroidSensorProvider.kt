package com.motionmouse.motion

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.view.Surface
import android.view.WindowManager
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.buffer
import kotlinx.coroutines.flow.callbackFlow

class AndroidSensorProvider(
    private val context: Context
) : SensorProvider {
    private val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager

    override val samples: Flow<MotionSample> = callbackFlow {
        val listener = object : SensorEventListener {
            private var lastGyro: Vector3? = null
            private var lastAcc: Vector3? = null
            private var lastAttitude: Attitude? = null

            override fun onSensorChanged(event: SensorEvent) {
                val timestamp = event.timestamp / 1_000_000L // ns to ms
                
                var hasNewData = false
                
                when (event.sensor.type) {
                    Sensor.TYPE_GYROSCOPE -> {
                        lastGyro = Vector3(event.values[0], event.values[1], event.values[2])
                        hasNewData = true
                    }
                    Sensor.TYPE_ACCELEROMETER -> {
                        lastAcc = Vector3(event.values[0], event.values[1], event.values[2])
                    }
                    Sensor.TYPE_ROTATION_VECTOR -> {
                        val rotationMatrix = FloatArray(9)
                        SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values)
                        val orientation = FloatArray(3)
                        SensorManager.getOrientation(rotationMatrix, orientation)
                        // orientation: [azimuth (yaw), pitch, roll]
                        lastAttitude = Attitude(orientation[0], orientation[1], orientation[2])
                        hasNewData = true
                    }
                }
                
                if (hasNewData) {
                    val rotation = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        try {
                            context.display?.rotation ?: Surface.ROTATION_0
                        } catch (e: Exception) {
                            @Suppress("DEPRECATION")
                            windowManager.defaultDisplay.rotation
                        }
                    } else {
                        @Suppress("DEPRECATION")
                        windowManager.defaultDisplay.rotation
                    }
                    
                    trySend(MotionSample(
                        timestampMs = timestamp,
                        gyro = lastGyro,
                        acceleration = lastAcc,
                        attitude = lastAttitude,
                        displayOrientation = rotation,
                        capabilities = MotionCapabilities(
                            fusedAttitude = lastAttitude != null,
                            gyroscope = lastGyro != null,
                            accelerometer = lastAcc != null
                        )
                    ))
                }
            }

            override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
        }

        val gyro = sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE)
        val acc = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        val rotVec = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
        
        sensorManager.registerListener(listener, gyro, SensorManager.SENSOR_DELAY_FASTEST)
        sensorManager.registerListener(listener, acc, SensorManager.SENSOR_DELAY_FASTEST)
        sensorManager.registerListener(listener, rotVec, SensorManager.SENSOR_DELAY_FASTEST)

        awaitClose {
            sensorManager.unregisterListener(listener)
        }
    }.buffer(Channel.CONFLATED)
}
