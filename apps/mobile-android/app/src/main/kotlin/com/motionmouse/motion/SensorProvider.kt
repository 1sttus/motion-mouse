package com.motionmouse.motion

import kotlinx.coroutines.flow.Flow

interface SensorProvider {
    val samples: Flow<MotionSample>
}
