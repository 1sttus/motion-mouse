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
import android.view.WindowManager
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Refresh
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
import com.motionmouse.ui.SettingsActivity
import com.motionmouse.ui.theme.MotionMouseTheme
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.text.font.FontWeight

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
                        onCalibrateClick = { motionEngine.calibrate(); networkClient?.sendCalibrate() },
                        onSettingsClick = { launchSettings() }
                    )
                } else {
                    MainScreen(
                        status = connectionStatus.value,
                        server = serverInfo.value,
                        isRunning = isRunning.value,
                        onScanClick = { launchScanner() },
                        onToggleRunning = { toggleRunning() },
                        onCalibrateClick = { motionEngine.calibrate(); networkClient?.sendCalibrate() },
                        onSettingsClick = { launchSettings() }
                    )
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        refreshSettings()
    }

    private fun refreshSettings() {
        val sharedPref = getSharedPreferences("motion_mouse_prefs", Context.MODE_PRIVATE)
        val sensitivity = sharedPref.getFloat("sensitivity", 1.0f)
        val keepScreenOn = sharedPref.getBoolean("keep_screen_on", false)

        motionEngine.setSensitivityFactor(sensitivity)

        if (keepScreenOn) {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        } else {
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
    }

    private fun launchSettings() {
        startActivity(Intent(this, SettingsActivity::class.java))
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
            val host = uri.getQueryParameter("ip") ?: uri.host ?: throw Exception("Invalid host")
            val port = uri.getQueryParameter("port")?.toIntOrNull() ?: if (uri.port != -1) uri.port else 8080
            val token = uri.getQueryParameter("token") ?: throw Exception("Missing token")
            
            // Use just wss://host:port for the base connection
            val url = "wss://$host:$port"
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
                        saveDevice(url)
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

    private fun saveDevice(url: String) {
        val sharedPref = getSharedPreferences("motion_mouse_prefs", Context.MODE_PRIVATE)
        val devices = sharedPref.getStringSet("paired_devices", emptySet())?.toMutableSet() ?: mutableSetOf()
        if (devices.add(url)) {
            sharedPref.edit().putStringSet("paired_devices", devices).apply()
        }
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
        if (::sensorManager.isInitialized) {
            sensorManager.unregisterListener(this)
        }
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    status: String,
    server: String,
    isRunning: Boolean,
    onScanClick: () -> Unit,
    onToggleRunning: () -> Unit,
    onCalibrateClick: () -> Unit,
    onSettingsClick: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Motion Mouse", fontWeight = FontWeight.Bold) },
                actions = {
                    IconButton(onClick = onSettingsClick) {
                        Icon(Icons.Default.Settings, contentDescription = "Settings")
                    }
                }
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            // Connection Status Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                )
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = if (status == "AUTHENTICATED") Icons.Default.CheckCircle else Icons.Default.Warning,
                            contentDescription = null,
                            tint = if (status == "AUTHENTICATED") Color(0xFF4CAF50) else MaterialTheme.colorScheme.error
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = if (status == "AUTHENTICATED") "Connected" else status,
                            style = MaterialTheme.typography.titleMedium
                        )
                    }
                    if (server.isNotEmpty()) {
                        Text(
                            text = server,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            // Main Actions
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Button(
                    onClick = onScanClick,
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    shape = ShapeDefaults.Medium
                ) {
                    Icon(Icons.Default.Refresh, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Pair New Device")
                }

                Button(
                    onClick = onToggleRunning,
                    modifier = Modifier.fillMaxWidth().height(64.dp),
                    shape = ShapeDefaults.Medium,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isRunning) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
                    )
                ) {
                    Text(
                        if (isRunning) "STOP CONTROL" else "START CONTROL",
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold
                    )
                }

                OutlinedButton(
                    onClick = onCalibrateClick,
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    shape = ShapeDefaults.Medium
                ) {
                    Icon(Icons.Default.Refresh, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Recenter / Calibrate")
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InteractionScreen(
    onButtonAction: (String, String) -> Unit,
    onScroll: (Int, Int) -> Unit,
    onStopClick: () -> Unit,
    onCalibrateClick: () -> Unit,
    onSettingsClick: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Active Control", style = MaterialTheme.typography.titleSmall) },
                actions = {
                    IconButton(onClick = onSettingsClick) {
                        Icon(Icons.Default.Settings, contentDescription = "Settings")
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onStopClick) {
                        Icon(Icons.Default.Warning, contentDescription = "Stop", tint = Color.Red)
                    }
                }
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            // Click Zones
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(0.5f)
                    .padding(12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Left Click Zone
                Surface(
                    modifier = Modifier
                        .fillMaxHeight()
                        .weight(1.2f)
                        .pointerInput(Unit) {
                            detectTapGestures(
                                onPress = {
                                    onButtonAction("left", "down")
                                    tryAwaitRelease()
                                    onButtonAction("left", "up")
                                }
                            )
                        },
                    shape = ShapeDefaults.Large,
                    color = MaterialTheme.colorScheme.primaryContainer,
                    tonalElevation = 4.dp
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(
                            "LEFT",
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                }

                Column(
                    modifier = Modifier.weight(0.8f),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Right Click
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f)
                            .pointerInput(Unit) {
                                detectTapGestures(
                                    onPress = {
                                        onButtonAction("right", "down")
                                        tryAwaitRelease()
                                        onButtonAction("right", "up")
                                    }
                                )
                            },
                        shape = ShapeDefaults.Large,
                        color = MaterialTheme.colorScheme.secondaryContainer
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text("RIGHT", fontWeight = FontWeight.Bold)
                        }
                    }
                    // Middle Click
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(0.6f)
                            .pointerInput(Unit) {
                                detectTapGestures(
                                    onPress = {
                                        onButtonAction("middle", "down")
                                        tryAwaitRelease()
                                        onButtonAction("middle", "up")
                                    }
                                )
                            },
                        shape = ShapeDefaults.Large,
                        color = MaterialTheme.colorScheme.tertiaryContainer
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text("MID", style = MaterialTheme.typography.labelMedium)
                        }
                    }
                }
            }

            // Scroll Zone
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(0.5f)
                    .padding(12.dp)
                    .pointerInput(Unit) {
                        detectDragGestures { change, dragAmount ->
                            change.consume()
                            onScroll(dragAmount.x.toInt() * 2, dragAmount.y.toInt() * 2)
                        }
                    },
                shape = ShapeDefaults.Large,
                color = MaterialTheme.colorScheme.surfaceVariant
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.Refresh,
                            contentDescription = null,
                            modifier = Modifier.size(48.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.3f)
                        )
                        Text(
                            "SCROLL AREA",
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                        )
                    }
                }
            }

            // Recenter Button in Active Screen
            Button(
                onClick = onCalibrateClick,
                modifier = Modifier.fillMaxWidth().padding(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary)
            ) {
                Text("RECENTER")
            }
        }
    }
}
