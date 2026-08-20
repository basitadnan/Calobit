package com.calobit.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.IBinder
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import kotlin.math.max
import kotlin.math.sqrt

/**
 * WalkTrackerService
 *
 * A foreground service that owns the step tracking while a Walk/Run session is
 * active. Because it is a foreground service, Android keeps it (and the
 * sensors) running even when the app is in the background or the screen is
 * off. The web layer polls [StepCounterPlugin.getSnapshot] for live progress
 * and folds the accumulated totals when the session ends.
 *
 * Steps come from two sources, whichever counts more:
 *  - Sensor.TYPE_STEP_COUNTER (hardware pedometer; needs ACTIVITY_RECOGNITION
 *    permission on Android 10+).
 *  - An accelerometer peak detector with no permission requirements, using the
 *    magnitude of the gravity-included vector so it works no matter how the
 *    phone is held (pocket, hand, in use) — this is what keeps counting when
 *    the hardware counter misses steps.
 *
 * Distance is derived from steps × stride length (based on the user's height),
 * so it always reflects the step count instead of depending on GPS.
 */
class WalkTrackerService : Service(), SensorEventListener {

    class Summary(
        val steps: Int,
        val distanceMeters: Double,
        val durationSec: Long,
        val activityType: String
    )

    companion object {
        const val ACTION_START = "com.calobit.app.action.START_TRACKING"
        const val ACTION_STOP = "com.calobit.app.action.STOP_TRACKING"
        const val EXTRA_TYPE = "activityType"
        const val EXTRA_HEIGHT_CM = "heightCm"
        private const val CHANNEL_ID = "walk_tracker"
        private const val NOTIF_ID = 1001

        // Accelerometer step-detection tuning (m/s² deviations from baseline).
        // Balanced: a step needs a real bounce — the deviation must stay above
        // PEAK for DWELL ms and complete before ARM_MAX ms. A sustained
        // deviation (phone moved/tilted, not a step) re-anchors the baseline
        // without counting instead of counting phantom steps.
        private const val ACCEL_PEAK_THRESHOLD = 1.3f
        private const val ACCEL_DISARM_THRESHOLD = 0.55f
        private const val ACCEL_DWELL_MS = 100L
        private const val ACCEL_ARM_MAX_MS = 600L
        private const val MIN_ACCEL_STEP_MS = 320L

        @Volatile
        var instance: WalkTrackerService? = null
            private set

        /** Last completed segment, kept so a stopped session can still be folded into the web layer. */
        @Volatile
        var lastSummary: Summary? = null
            private set
    }

    private var sensorManager: SensorManager? = null
    private var stepSensor: Sensor? = null
    private var accelSensor: Sensor? = null

    private var stepBaseline = 0f
    private var counterSteps = 0
    private var accelBaseline = 0f
    private var accelArmed = false
    private var accelArmedSinceAt = 0L
    private var accelWasAbovePeak = false
    private var accelRunStartAt = 0L
    private var accelAboveAt = 0L
    private var accelStepCount = 0
    private var lastAccelStepAt = 0L
    private var sensorsRegistered = false
    private var strideMeters = 0.414 * 170.0 / 100.0 // walk stride for 170cm until height arrives
    private var lastNotifUpdate = 0L
    private var startedAt = 0L

    @Volatile
    var isTracking = false
        private set

    @Volatile
    var steps = 0
        private set

    @Volatile
    var distanceMeters = 0.0
        private set

    @Volatile
    var activityType = "walk"
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        stepSensor = sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
        accelSensor = sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action ?: ACTION_START) {
            ACTION_START -> startTracking(
                type = intent?.getStringExtra(EXTRA_TYPE) ?: "walk",
                heightCm = intent?.getIntExtra(EXTRA_HEIGHT_CM, 170) ?: 170
            )
            ACTION_STOP -> stopTracking()
        }
        return START_NOT_STICKY
    }

    private fun startTracking(type: String, heightCm: Int) {
        if (!isTracking) {
            isTracking = true
            lastSummary = null
            activityType = type
            steps = 0
            distanceMeters = 0.0
            counterSteps = 0
            accelStepCount = 0
            accelBaseline = 0f
            accelArmed = false
            accelArmedSinceAt = 0L
            accelWasAbovePeak = false
            accelRunStartAt = 0L
            accelAboveAt = 0L
            lastAccelStepAt = Long.MIN_VALUE // never stepped yet — don't drop the first step
            startedAt = SystemClock.elapsedRealtime()
            stepBaseline = 0f
            val h = if (heightCm in 100..230) heightCm else 170
            val baseStride = h * 0.414 / 100.0
            strideMeters = if (type == "running") baseStride * 1.35 else baseStride
            registerSensors()
        }
        startForegroundCompat()
        updateNotification()
    }

    private fun startForegroundCompat() {
        val notification = buildNotification()
        // android.app.ServiceCompat requires an explicit type. Health is the FGS
        // type for exercise tracking and only exists on API 34+; on older
        // devices we pass NONE (types were not enforced before Android 14).
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH
        } else {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_NONE
        }
        ServiceCompat.startForeground(this, NOTIF_ID, notification, type)
    }

    private fun stopTracking() {
        if (isTracking) {
            lastSummary = Summary(
                steps = steps,
                distanceMeters = distanceMeters,
                durationSec = durationSec(),
                activityType = activityType
            )
        }
        isTracking = false
        if (sensorsRegistered) {
            sensorManager?.unregisterListener(this)
            sensorsRegistered = false
        }
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        super.onDestroy()
        if (isTracking) stopTracking()
        instance = null
    }

    override fun onBind(intent: Intent?): IBinder? = null

    @SuppressLint("MissingPermission")
    private fun registerSensors() {
        if (sensorsRegistered) return

        // Hardware pedometer — needs ACTIVITY_RECOGNITION on Android 10+.
        if (stepSensor != null) {
            val hasPermission = ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.ACTIVITY_RECOGNITION
            ) == PackageManager.PERMISSION_GRANTED
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || hasPermission) {
                sensorManager?.registerListener(this, stepSensor, SensorManager.SENSOR_DELAY_NORMAL)
            }
        }

        // Raw accelerometer — no permission required; keeps counting regardless
        // of device orientation or the step-sensor permission being denied.
        accelSensor?.let {
            sensorManager?.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME)
        }

        sensorsRegistered = true
    }

    override fun onSensorChanged(event: SensorEvent) {
        if (!isTracking) return
        when (event.sensor.type) {
            Sensor.TYPE_STEP_COUNTER -> {
                val total = event.values[0]
                if (stepBaseline == 0f || total < stepBaseline) {
                    // First event of the segment (or the device rebooted): establish a fresh baseline.
                    stepBaseline = total
                    counterSteps = 0
                } else {
                    counterSteps = (total - stepBaseline).toInt()
                }
            }
            Sensor.TYPE_ACCELEROMETER -> detectAccelStep(event.values)
            else -> return
        }
        steps = max(counterSteps, accelStepCount)
        distanceMeters = steps * strideMeters
        updateNotification()
    }

    /** Peak detection on the acceleration magnitude (rotation-invariant, so it
     *  counts body bounces regardless of how the phone is held).
     *
     *  A step is a real bounce: the deviation must rise above PEAK, stay there
     *  at least DWELL ms, and fall back below DISARM — all within ARM_MAX ms.
     *  The baseline is frozen while armed so a step's own signal can't drag it
     *  toward the peak, and a deviation that outlives ARM_MAX (a tilt or phone
     *  move) re-anchors the baseline without counting. */
    private fun detectAccelStep(values: FloatArray) {
        val mag = sqrt(values[0] * values[0] + values[1] * values[1] + values[2] * values[2])
        if (accelBaseline <= 0f) {
            accelBaseline = mag
            return
        }
        val dev = mag - accelBaseline
        val now = SystemClock.uptimeMillis()
        if (accelArmed) {
            if (dev > ACCEL_PEAK_THRESHOLD) {
                if (!accelWasAbovePeak) accelRunStartAt = now // a new run above peak began
                accelWasAbovePeak = true
                accelAboveAt = now
            } else {
                accelWasAbovePeak = false
            }
            // Sustained deviation = phone was moved/tilted, not a step.
            if (now - accelArmedSinceAt > ACCEL_ARM_MAX_MS) {
                accelArmed = false
                accelBaseline = mag
                return
            }
            if (dev < ACCEL_DISARM_THRESHOLD) {
                accelArmed = false
                // The step counts only if the bounce really spent DWELL ms above
                // the peak (span of the above-peak run), not just touched it.
                val dwell = if (accelAboveAt > 0 && accelRunStartAt > 0) {
                    accelAboveAt - accelRunStartAt
                } else 0L
                if (dwell >= ACCEL_DWELL_MS && (now - lastAccelStepAt) >= MIN_ACCEL_STEP_MS) {
                    lastAccelStepAt = now
                    accelStepCount++
                }
            }
        } else {
            // Not armed: the baseline keeps adapting (slowly — 0.02/sample, so
            // it converges on the signal's resting mean without being able to
            // chase a single step bounce, which would compress the deviation).
            accelBaseline = accelBaseline * 0.98f + mag * 0.02f
            if (dev > ACCEL_PEAK_THRESHOLD) {
                accelArmed = true
                accelArmedSinceAt = now
                accelWasAbovePeak = true
                accelRunStartAt = now
                accelAboveAt = now
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    fun durationSec(): Long =
        if (isTracking && startedAt > 0) (SystemClock.elapsedRealtime() - startedAt) / 1000 else 0L

    private fun buildNotification(): Notification {
        val title = if (activityType == "running") "🏃 Running" else "🚶 Walking"
        val body = "${formatDuration(durationSec())} • ${"%.2f".format(distanceMeters / 1000.0)} km • $steps steps"
        val contentIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val stopIntent = PendingIntent.getService(
            this, 1,
            Intent(this, WalkTrackerService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_walk)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(contentIntent)
            .addAction(0, "Stop", stopIntent)
            .build()
    }

    private fun updateNotification() {
        val now = SystemClock.elapsedRealtime()
        if (now - lastNotifUpdate < 2000) return
        lastNotifUpdate = now
        try {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.notify(NOTIF_ID, buildNotification())
        } catch (_: Exception) {
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Walk / Run tracking",
                NotificationManager.IMPORTANCE_LOW
            )
            channel.description = "Live progress of your walk or run session"
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(channel)
        }
    }

    private fun formatDuration(totalSeconds: Long): String {
        val h = totalSeconds / 3600
        val m = (totalSeconds % 3600) / 60
        val s = totalSeconds % 60
        return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%02d:%02d".format(m, s)
    }
}