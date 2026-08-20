package com.calobit.app

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

/**
 * StepCounterPlugin
 *
 * Session-based control of the Walk/Run tracker. All live accumulation (steps
 * via the hardware pedometer plus an accelerometer fallback) happens inside
 * [WalkTrackerService], a foreground service, so tracking continues while the
 * app is backgrounded or the screen is off. Distance is derived from
 * steps × stride length in the service (and mirrored in JS).
 *
 * Methods: isAvailable(), startSession(activityType, heightCm), stopSession(),
 * getSnapshot(). JS polls getSnapshot() for live progress and folds the final
 * summary from stopSession() (or the last completed summary) when paused.
 */
@CapacitorPlugin(
    name = "StepCounter",
    permissions = [
        Permission(alias = "activityRecognition", strings = [Manifest.permission.ACTIVITY_RECOGNITION])
    ]
)
class StepCounterPlugin : Plugin() {

    private var lastPermissionType = "walk"
    private var lastPermissionHeightCm = 170

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val sm = activity.getSystemService(Context.SENSOR_SERVICE) as SensorManager
        val sensor = sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
        val accel = sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        val ret = JSObject()
        ret.put("available", sensor != null)
        // The accelerometer detector needs no permission, so steps can always be counted.
        ret.put("accelerometerAvailable", accel != null)
        call.resolve(ret)
    }

    @PluginMethod
    fun startSession(call: PluginCall) {
        val type = call.getString("activityType") ?: "walk"
        val heightCm = call.getInt("heightCm", 170) ?: 170
        if (getPermissionState("activityRecognition") != PermissionState.GRANTED) {
            lastPermissionType = type
            lastPermissionHeightCm = heightCm
            requestPermissionForAlias("activityRecognition", call, "permissionCallback")
            return
        }
        val ret = JSObject()
        ret.put("sensorDenied", false)
        startServiceWithType(call, type, heightCm, ret)
    }

    @PermissionCallback
    private fun permissionCallback(call: PluginCall) {
        val granted = getPermissionState("activityRecognition") == PermissionState.GRANTED
        val ret = JSObject()
        ret.put("sensorDenied", !granted)
        // Even without the step-sensor permission, the service still counts
        // steps via the accelerometer (no permission needed) in the background.
        startServiceWithType(call, lastPermissionType, lastPermissionHeightCm, ret)
    }

    private fun startServiceWithType(call: PluginCall, type: String, heightCm: Int, ret: JSObject) {
        requestNotificationPermissionIfNeeded()
        val intent = Intent(activity, WalkTrackerService::class.java).apply {
            action = WalkTrackerService.ACTION_START
            putExtra(WalkTrackerService.EXTRA_TYPE, type)
            putExtra(WalkTrackerService.EXTRA_HEIGHT_CM, heightCm)
        }
        ContextCompat.startForegroundService(activity, intent)
        call.resolve(ret)
    }

    @PluginMethod
    fun stopSession(call: PluginCall) {
        val service = WalkTrackerService.instance
        val ret = JSObject()
        if (service != null && service.isTracking) {
            fillSnapshot(ret, service)
        } else {
            ret.put("tracking", false)
            val summary = WalkTrackerService.lastSummary
            if (summary != null) {
                ret.put("steps", summary.steps)
                ret.put("distanceKm", summary.distanceMeters / 1000.0)
                ret.put("durationSec", summary.durationSec)
                ret.put("activityType", summary.activityType)
            }
        }
        val intent = Intent(activity, WalkTrackerService::class.java).apply {
            action = WalkTrackerService.ACTION_STOP
        }
        ContextCompat.startForegroundService(activity, intent)
        call.resolve(ret)
    }

    @PluginMethod
    fun getSnapshot(call: PluginCall) {
        val ret = JSObject()
        val service = WalkTrackerService.instance
        if (service != null && service.isTracking) {
            fillSnapshot(ret, service)
        } else {
            ret.put("tracking", false)
        }
        call.resolve(ret)
    }

    private fun fillSnapshot(ret: JSObject, service: WalkTrackerService) {
        ret.put("tracking", service.isTracking)
        ret.put("steps", service.steps)
        ret.put("distanceKm", service.distanceMeters / 1000.0)
        ret.put("durationSec", service.durationSec())
        ret.put("activityType", service.activityType)
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            activity.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 9001)
        }
    }
}