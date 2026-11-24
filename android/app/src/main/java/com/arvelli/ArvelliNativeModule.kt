package com.arvelli

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.auth.api.phone.SmsRetriever
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Status

/**
 * Native helpers used by the WebView shell:
 *  - openWhatsApp: lets the user pick WhatsApp or WhatsApp Business when both are installed.
 *  - startOtpListener: uses the SMS User Consent API (no SMS permission needed) to read the
 *    next OTP SMS and emit it to JS as an "onOtpReceived" event.
 */
class ArvelliNativeModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

  companion object {
    private const val NAME = "ArvelliNative"
    private const val SMS_CONSENT_REQUEST = 4711
    private val WHATSAPP_PACKAGES = listOf("com.whatsapp", "com.whatsapp.w4b")
    private val OTP_REGEX = Regex("(?<!\\d)(\\d{4,8})(?!\\d)")
  }

  private var smsReceiver: BroadcastReceiver? = null

  init {
    reactContext.addActivityEventListener(this)
  }

  override fun getName(): String = NAME

  // ---------------------------------------------------------------- WhatsApp

  private fun isInstalled(pkg: String): Boolean {
    val pm = reactContext.packageManager
    return try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        pm.getPackageInfo(pkg, PackageManager.PackageInfoFlags.of(0))
      } else {
        @Suppress("DEPRECATION") pm.getPackageInfo(pkg, 0)
      }
      true
    } catch (e: PackageManager.NameNotFoundException) {
      false
    }
  }

  @ReactMethod
  fun openWhatsApp(url: String, chooserTitle: String, promise: Promise) {
    val uri = Uri.parse(url)
    val installed = WHATSAPP_PACKAGES.filter { isInstalled(it) }
    val activity = reactApplicationContext.currentActivity
    val starter: (Intent) -> Unit = { intent ->
      if (activity != null) {
        activity.startActivity(intent)
      } else {
        reactContext.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
    }

    try {
      when (installed.size) {
        0 -> {
          // No WhatsApp app: let the browser handle wa.me / api.whatsapp.com links.
          if (uri.scheme == "whatsapp") {
            promise.resolve(false)
            return
          }
          starter(Intent(Intent.ACTION_VIEW, uri))
        }
        1 -> starter(Intent(Intent.ACTION_VIEW, uri).setPackage(installed[0]))
        else -> {
          // Explicit targets so the system default ("always open with") is bypassed.
          val primary = Intent(Intent.ACTION_VIEW, uri).setPackage(installed[0])
          val others = installed.drop(1)
              .map { Intent(Intent.ACTION_VIEW, uri).setPackage(it) }
              .toTypedArray()
          val chooser = Intent.createChooser(primary, chooserTitle)
          chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, others)
          starter(chooser)
        }
      }
      promise.resolve(true)
    } catch (e: ActivityNotFoundException) {
      promise.resolve(false)
    } catch (e: Exception) {
      promise.reject("E_WHATSAPP", e)
    }
  }

  // ---------------------------------------------------------------- OTP (SMS User Consent)

  @ReactMethod
  fun startOtpListener(promise: Promise) {
    try {
      registerSmsReceiver()
      SmsRetriever.getClient(reactContext)
          .startSmsUserConsent(null)
          .addOnSuccessListener { promise.resolve(true) }
          .addOnFailureListener { promise.resolve(false) }
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun stopOtpListener() {
    unregisterSmsReceiver()
  }

  private fun registerSmsReceiver() {
    if (smsReceiver != null) return
    val receiver = object : BroadcastReceiver() {
      override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != SmsRetriever.SMS_RETRIEVED_ACTION) return
        val extras = intent.extras ?: return
        val status = getParcelableCompat<Status>(intent, SmsRetriever.EXTRA_STATUS) ?: return
        if (status.statusCode != CommonStatusCodes.SUCCESS) {
          unregisterSmsReceiver()
          return
        }
        val consentIntent =
            getParcelableCompat<Intent>(intent, SmsRetriever.EXTRA_CONSENT_INTENT) ?: return
        val activity = reactApplicationContext.currentActivity ?: return
        try {
          activity.startActivityForResult(consentIntent, SMS_CONSENT_REQUEST)
        } catch (e: ActivityNotFoundException) {
          // ignore
        }
        extras.clear()
      }
    }
    val filter = IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION)
    ContextCompat.registerReceiver(
        reactContext,
        receiver,
        filter,
        SmsRetriever.SEND_PERMISSION,
        null,
        ContextCompat.RECEIVER_EXPORTED,
    )
    smsReceiver = receiver
  }

  private fun unregisterSmsReceiver() {
    smsReceiver?.let {
      try {
        reactContext.unregisterReceiver(it)
      } catch (e: Exception) {
        // already unregistered
      }
    }
    smsReceiver = null
  }

  @Suppress("DEPRECATION")
  private inline fun <reified T : android.os.Parcelable> getParcelableCompat(
      intent: Intent,
      key: String,
  ): T? =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        intent.getParcelableExtra(key, T::class.java)
      } else {
        intent.getParcelableExtra(key)
      }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != SMS_CONSENT_REQUEST) return
    unregisterSmsReceiver()
    if (resultCode != Activity.RESULT_OK || data == null) return
    val message = data.getStringExtra(SmsRetriever.EXTRA_SMS_MESSAGE) ?: return
    val code = OTP_REGEX.find(message)?.groupValues?.get(1) ?: return
    val params = Arguments.createMap().apply { putString("code", code) }
    reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("onOtpReceived", params)
  }

  override fun onNewIntent(intent: Intent) {}

  override fun invalidate() {
    unregisterSmsReceiver()
    reactContext.removeActivityEventListener(this)
    super.invalidate()
  }

  // Required by NativeEventEmitter on the JS side.
  @ReactMethod fun addListener(eventName: String) {}

  @ReactMethod fun removeListeners(count: Int) {}
}
