package com.motionmouse

import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.net.Uri
import android.os.Bundle
import android.view.Surface
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.rememberTransformableState
import androidx.compose.foundation.gestures.transformable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.motionmouse.motion.*
import com.motionmouse.ui.ScannerActivity
import com.motionmouse.ui.OnboardingActivity
import com.motionmouse.ui.theme.MotionMouseTheme
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.ui.geometry.Offset

class MainActivity : ComponentActivity(), SensorEventListener {
    private var networkClient: NetworkClient? = null
    private lateinit var motionEngine: MotionEngine
    private lateinit var sensorManager: SensorManager
    
    private var isRunning = mutableStateOf(false)
    private var connectionStatus = mutableStateOf("Not Connected")
    private var serverInfo = mutableStateOf("")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        val sharedPref = getSharedPreferences("motion_mouse_prefs", Context.MODE_PRIVATE)
        if (!sharedPref.getBoolean("onboarding_complete", false)) {
            startActivity(Intent(this, OnboardingActivity::class.java))
            finish()
            return
        }

        enableEdgeToEdge()
        
        motionEngine = MotionEngine()
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        
        setContent {
            MotionMouseTheme {
                if (isRunning.value) {
                    InteractionScreen(
                        onButtonAction = { btn, act -> networkClient?.sendButton(btn, act) },
                        onScroll = { dx, dy -> networkClient?.sendScroll(dx, dy) },
                        onStopClick = { toggleRunning() },
                        onCalibrateClick = { motionEngine.calibrate(); networkClient?.sendCalibrate() }
                    )
                } else {
                    MainScreen(
                        status = connectionStatus.value,
                        server = serverInfo.value,
                        isRunning = isRunning.value,
                        onScanClick = { launchScanner() },
                        onToggleRunning = { toggleRunning() },
                        onCalibrateClick = { motionEngine.calibrate(); networkClient?.sendCalibrate() }
                    )
                }
            }
        }
    }

    private fun launchScanner() {
        val intent = Intent(this, ScannerActivity::class.java)
        scannerLauncher.launch(intent)
    }

    private val scannerLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == RESULT_OK) {
            val qrContent = result.data?.getStringExtra("qr_content") ?: return@registerForActivityResult
            handleScannedQr(qrContent)
        }
    }

    private fun handleScannedQr(content: String) {
        try {
            val uri = Uri.parse(content)
            val host = uri.host ?: throw Exception("Invalid host")
            val port = if (uri.port != -1) uri.port else 8080
            val token = uri.getQueryParameter("token") ?: throw Exception("Missing token")
            
            val url = "wss://$host:$port/ws"
            serverInfo.value = "$host:$port"
            
            connectToServer(url, token)
        } catch (e: Exception) {
            Toast.makeText(this, "Invalid QR: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    private fun connectToServer(url: String, token: String) {
        networkClient?.disconnect()
        networkClient = NetworkClient(token, url)
        
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                networkClient?.connectionState?.collectLatest { state ->
                    connectionStatus.value = state.name
                    if (state == NetworkClient.ConnectionState.AUTHENTICATED) {
                        Toast.makeText(this@MainActivity, "Connected!", Toast.LENGTH_SHORT).show()
                    } else if (state == NetworkClient.ConnectionState.ERROR) {
                        isRunning.value = false
                        stopSensors()
                    }
                }
            }
        }
        
        networkClient?.connect()
    }

    private fun toggleRunning() {
        if (networkClient?.connectionState?.value != NetworkClient.ConnectionState.AUTHENTICATED) {
            Toast.makeText(this, "Connect to a server first", Toast.LENGTH_SHORT).show()
            return
        }

        isRunning.value = !isRunning.value
        if (isRunning.value) {
            startSensors()
            motionEngine.resume()
        } else {
            stopSensors()
            motionEngine.pause()
        }
    }

    private fun startSensors() {
        val gyro = sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE)
        val accel = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        sensorManager.registerListener(this, gyro, SensorManager.SENSOR_DELAY_GAME)
        sensorManager.registerListener(this, accel, SensorManager.SENSOR_DELAY_GAME)
    }

    private fun stopSensors() {
        sensorManager.unregisterListener(this)
    }

    override fun onSensorChanged(event: SensorEvent) {
        if (!isRunning.value) return
        
        val rotation = try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
                display?.rotation ?: Surface.ROTATION_0
            } else {
                windowManager.defaultDisplay.rotation
            }
        } catch (e: Exception) {
            Surface.ROTATION_0
        }

        val sample = when (event.sensor.type) {
            Sensor.TYPE_GYROSCOPE -> MotionSample(
                timestampMs = System.currentTimeMillis(),
                gyro = Vector3(event.values[0], event.values[1], event.values[2]),
                capabilities = MotionCapabilities(fusedAttitude = false, gyroscope = true, accelerometer = true),
                displayOrientation = rotation
            )
            Sensor.TYPE_ACCELEROMETER -> MotionSample(
                timestampMs = System.currentTimeMillis(),
                acceleration = Vector3(event.values[0], event.values[1], event.values[2]),
                capabilities = MotionCapabilities(fusedAttitude = false, gyroscope = true, accelerometer = true),
                displayOrientation = rotation
            )
            else -> null
        }
        
        sample?.let {
            val packet = motionEngine.process(it)
            packet?.let { p ->
                networkClient?.sendDelta(p.deltaX.toInt(), p.deltaY.toInt())
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    override fun onDestroy() {
        super.onDestroy()
        networkClient?.disconnect()
        stopSensors()
    }
}

@Composable
fun MainScreen(
    status: String,
    server: String,
    isRunning: Boolean,
    onScanClick: () -> Unit,
    onToggleRunning: () -> Unit,
    onCalibrateClick: () -> Unit
) {
    Scaffold { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(text = "Motion Mouse", style = MaterialTheme.typography.headlineLarge)
            Spacer(modifier = Modifier.height(24.dp))
            
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(text = "Status: $status", style = MaterialTheme.typography.bodyLarge)
                    Text(text = "Server: ${if (server.isEmpty()) "None" else server}", style = MaterialTheme.typography.bodyMedium)
                }
            }
            
            Spacer(modifier = Modifier.height(32.dp))
            
            Button(onClick = onScanClick, modifier = Modifier.fillMaxWidth()) {
                Text("Scan Pairing QR")
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            Button(
                onClick = onToggleRunning,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (isRunning) Color.Red else MaterialTheme.colorScheme.primary
                )
            ) {
                Text(if (isRunning) "Stop Control" else "Start Control")
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            OutlinedButton(onClick = onCalibrateClick, modifier = Modifier.fillMaxWidth()) {
                Text("Calibrate / Recenter")
            }
        }
    }
}

@Composable
fun InteractionScreen(
    onButtonAction: (String, String) -> Unit,
    onScroll: (Int, Int) -> Unit,
    onStopClick: () -> Unit,
    onCalibrateClick: () -> Unit
) {
    Scaffold { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            // Top Controls
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(8.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Button(onClick = onStopClick, colors = ButtonDefaults.buttonColors(containerColor = Color.Red)) {
                    Text("Stop")
                }
                Button(onClick = onCalibrateClick) {
                    Text("Recenter")
                }
            }

            // Click Zones
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(0.4f)
                    .padding(8.dp)
            ) {
                // Left Click Zone
                Box(
                    modifier = Modifier
                        .fillMaxHeight()
                        .weight(1f)
                        .padding(4.dp)
                        .background(MaterialTheme.colorScheme.primaryContainer)
                        .pointerInput(Unit) {
                            detectTapGestures(
                                onPress = {
                                    onButtonAction("left", "down")
                                    tryAwaitRelease()
                                    onButtonAction("left", "up")
                                }
                            )
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Text("LEFT CLICK", color = MaterialTheme.colorScheme.onPrimaryContainer)
                }

                Column(modifier = Modifier.weight(0.5f)) {
                    // Right Click
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f)
                            .padding(4.dp)
                            .background(MaterialTheme.colorScheme.secondaryContainer)
                            .pointerInput(Unit) {
                                detectTapGestures(
                                    onPress = {
                                        onButtonAction("right", "down")
                                        tryAwaitRelease()
                                        onButtonAction("right", "up")
                                    }
                                )
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        Text("RIGHT", color = MaterialTheme.colorScheme.onSecondaryContainer)
                    }
                    // Middle Click
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f)
                            .padding(4.dp)
                            .background(MaterialTheme.colorScheme.tertiaryContainer)
                            .pointerInput(Unit) {
                                detectTapGestures(
                                    onPress = {
                                        onButtonAction("middle", "down")
                                        tryAwaitRelease()
                                        onButtonAction("middle", "up")
                                    }
                                )
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        Text("MID", color = MaterialTheme.colorScheme.onTertiaryContainer)
                    }
                }
            }

            // Scroll Zone
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(0.6f)
                    .padding(8.dp)
                    .background(Color.Gray.copy(alpha = 0.2f))
                    .pointerInput(Unit) {
                        detectDragGestures { change, dragAmount ->
                            change.consume()
                            // Normalize scroll delta. Scroll wheel usually 120 per notch.
                            // We can use a multiplier based on drag amount.
                            onScroll(dragAmount.x.toInt() * 2, dragAmount.y.toInt() * 2)
                        }
                    },
                contentAlignment = Alignment.Center
            ) {
                Text("SCROLL ZONE")
            }
        }
    }
}
