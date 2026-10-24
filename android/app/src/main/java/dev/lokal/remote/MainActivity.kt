package dev.lokal.remote

import android.annotation.SuppressLint
import android.content.SharedPreferences
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val prefs: SharedPreferences = getSharedPreferences("lokal_remote", MODE_PRIVATE)
        setContent {
            MaterialTheme(colorScheme = darkColorScheme()) {
                RemoteApp(
                    savedServer = prefs.getString("server", "") ?: "",
                    onSave = { server -> prefs.edit().putString("server", server).apply() },
                )
            }
        }
    }
}

/** "192.168.1.50:3421" from whatever the person typed (scheme, path, spaces). */
fun normalizeServer(raw: String): String {
    return raw.trim()
        .replace(Regex("^https?://", RegexOption.IGNORE_CASE), "")
        .trimEnd('/')
        .removeSuffix("/remote")
}

@Composable
fun RemoteApp(savedServer: String, onSave: (String) -> Unit) {
    var address by rememberSaveable { mutableStateOf(savedServer) }
    var connectedTo by rememberSaveable { mutableStateOf(savedServer) }
    var error by rememberSaveable { mutableStateOf("") }
    var webView by remember { mutableStateOf<WebView?>(null) }

    if (connectedTo.isEmpty()) {
        Surface(modifier = Modifier.fillMaxSize(), color = Color(0xFF0B0B0B)) {
            SetupScreen(
                address = address,
                onAddress = { address = it },
                error = error,
                onConnect = {
                    val server = normalizeServer(address)
                    if (server.isEmpty()) {
                        error = "Enter your computer's address, like 192.168.1.50:3421"
                    } else {
                        error = ""
                        onSave(server)
                        connectedTo = server
                    }
                },
            )
        }
    } else {
        BackHandler {
            val view = webView
            if (view != null && view.canGoBack()) view.goBack() else connectedTo = ""
        }
        Surface(modifier = Modifier.fillMaxSize(), color = Color(0xFF0B0B0B)) {
            AndroidView(
                modifier = Modifier
                    .fillMaxSize()
                    .semantics { contentDescription = "remoteWebView" },
                factory = { context ->
                    WebView(context).apply {
                        layoutParams = ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT,
                        )
                        configureForRemote()
                        webViewClient = object : WebViewClient() {
                            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest) = false

                            // A main-frame failure means the computer is gone
                            // (asleep, left the network, wrong address): back to
                            // setup, with the address kept for editing.
                            override fun onReceivedError(view: WebView, request: WebResourceRequest, failure: WebResourceError) {
                                if (request.isForMainFrame) {
                                    error = "Could not reach $connectedTo: ${failure.description ?: "connection failed"}"
                                    connectedTo = ""
                                }
                            }
                        }
                        loadUrl("http://$connectedTo/remote")
                        webView = this
                    }
                },
                update = { view ->
                    val target = "http://$connectedTo/remote"
                    if (view.url != target) view.loadUrl(target)
                },
            )
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
private fun WebView.configureForRemote() {
    settings.javaScriptEnabled = true
    settings.domStorageEnabled = true
    settings.mediaPlaybackRequiresUserGesture = false
    settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
}

@Composable
private fun SetupScreen(address: String, onAddress: (String) -> Unit, error: String, onConnect: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("Lokal Remote", style = MaterialTheme.typography.headlineMedium, color = Color(0xFFF5F5F5))
        Text(
            "Control Lokal on your computer from this phone.",
            style = MaterialTheme.typography.bodyMedium,
            color = Color(0xFF9A9A9A),
            modifier = Modifier.padding(top = 6.dp, bottom = 28.dp),
        )
        OutlinedTextField(
            value = address,
            onValueChange = onAddress,
            label = { Text("Computer address") },
            placeholder = { Text("192.168.1.50:3421") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
            modifier = Modifier
                .fillMaxWidth()
                .semantics { contentDescription = "serverAddress" },
        )
        Text(
            if (error.isEmpty()) "Find the address in Lokal on the computer, in Settings."
            else error,
            style = MaterialTheme.typography.bodySmall,
            color = if (error.isEmpty()) Color(0xFF9A9A9A) else Color(0xFFF87171),
            modifier = Modifier
                .padding(top = 8.dp, bottom = 20.dp)
                .semantics { contentDescription = "serverHint" },
        )
        Button(
            onClick = onConnect,
            modifier = Modifier
                .fillMaxWidth()
                .semantics { contentDescription = "connectButton" },
        ) {
            Text("Connect")
        }
    }
}
