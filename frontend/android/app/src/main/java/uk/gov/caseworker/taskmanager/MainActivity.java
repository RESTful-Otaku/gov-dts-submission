package uk.gov.caseworker.taskmanager;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

/**
 * Normalizes WebView text scaling so layout matches CSS across OEM “Display size” / font scale.
 * In-app text sizing still applies via {@code document.documentElement.style.fontSize}.
 */
public class MainActivity extends BridgeActivity {

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    Bridge bridge = getBridge();
    if (bridge != null) {
      applyWebViewTextZoom(bridge.getWebView());
    }
  }

  @Override
  public void onResume() {
    super.onResume();
    Bridge bridge = getBridge();
    if (bridge != null) {
      applyWebViewTextZoom(bridge.getWebView());
    }
  }

  private static void applyWebViewTextZoom(WebView webView) {
    if (webView == null) return;
    WebSettings settings = webView.getSettings();
    if (settings == null) return;
    settings.setTextZoom(100);
  }
}
