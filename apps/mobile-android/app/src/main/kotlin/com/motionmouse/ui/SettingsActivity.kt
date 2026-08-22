package com.motionmouse.ui

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.motionmouse.ui.theme.MotionMouseTheme

class SettingsActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MotionMouseTheme {
                SettingsScreen(
                    onBackClick = { finish() }
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(onBackClick: () -> Unit) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val sharedPref = remember { context.getSharedPreferences("motion_mouse_prefs", Context.MODE_PRIVATE) }
    
    var sensitivity by remember { mutableFloatStateOf(sharedPref.getFloat("sensitivity", 1.0f)) }
    var keepScreenOn by remember { mutableStateOf(sharedPref.getBoolean("keep_screen_on", false)) }
    
    val pairedDevices = remember { 
        val set = sharedPref.getStringSet("paired_devices", emptySet()) ?: emptySet()
        mutableStateListOf<String>().apply { addAll(set) } 
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            item {
                Text("Controls", style = MaterialTheme.typography.titleLarge)
            }

            item {
                Column {
                    Text("Sensitivity: ${"%.1f".format(sensitivity)}x", style = MaterialTheme.typography.bodyLarge)
                    Spacer(modifier = Modifier.height(8.dp))
                    Slider(
                        value = sensitivity,
                        onValueChange = { 
                            sensitivity = it
                            sharedPref.edit().putFloat("sensitivity", it).apply()
                        },
                        valueRange = 0.1f..5.0f
                    )
                }
            }

            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Keep screen on", style = MaterialTheme.typography.bodyLarge)
                        Text("Prevents sleep during interaction", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.outline)
                    }
                    Switch(
                        checked = keepScreenOn,
                        onCheckedChange = {
                            keepScreenOn = it
                            sharedPref.edit().putBoolean("keep_screen_on", it).apply()
                        }
                    )
                }
            }

            item {
                HorizontalDivider()
            }

            item {
                Text("History", style = MaterialTheme.typography.titleLarge)
            }

            if (pairedDevices.isEmpty()) {
                item {
                    Text("No paired servers found.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.outline)
                }
            } else {
                items(pairedDevices) { device ->
                    ListItem(
                        headlineContent = { Text(device) },
                        trailingContent = {
                            IconButton(onClick = {
                                pairedDevices.remove(device)
                                sharedPref.edit().putStringSet("paired_devices", pairedDevices.toSet()).apply()
                            }) {
                                Icon(Icons.Default.Delete, contentDescription = "Remove")
                            }
                        }
                    )
                }
            }
        }
    }
}
