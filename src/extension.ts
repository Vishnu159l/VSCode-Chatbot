import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

	const provider = new ChatBotWebView(context.extensionUri);

	context.subscriptions.push(vscode.window.registerWebviewViewProvider(ChatBotWebView.viewType, provider));

}

class ChatBotWebView implements vscode.WebviewViewProvider {

	public static readonly viewType = 'Chatbot.webview';

	private _view?: vscode.WebviewView;

	constructor(private readonly _extensionUri: vscode.Uri,) { }

	public resolveWebviewView(webviewView: vscode.WebviewView,_context: vscode.WebviewViewResolveContext,_token: vscode.CancellationToken,) {
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,

			localResourceRoots: [
				this._extensionUri
			]
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
	}

	private _getHtmlForWebview(webview: vscode.Webview) {

		const arrowUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri,'media','arrow-up-svgrepo-com.svg'));
		const userUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri,'media','user-3-svgrepo-com.svg'));
		const botUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri,'media','bot-svgrepo-com.svg'));
		const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri,'media','style.css'));
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri,'media','script.js'));
		const bulbUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri,'media','light-bulb-13-svgrepo-com.svg'));
		const copyUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri,'media','copy-svgrepo-com.svg'));
		const tickUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri,'media','tick-svgrepo-com.svg'))

		const nonce = getNonce();

		return `<!DOCTYPE html>
				<html lang="en">
				<head>
				<link href="${cssUri}" rel="stylesheet">
				<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
				</head>
				<body>
					<div class="main-container">
						<div class="chat-container" id="chat-container-id">
						</div>
						<div class="botdiv">
							<div class="chatbox">
								<input type="text" id="Chatid" class="input-chat" placeholder="Ask Anything">
							</div>
							<div class="bulb">
                				<button class="button" onclick="updateState()" id="bulb-id">
                    				<img src="${bulbUri}" width="26px" height="30px">
                				</button>
            				</div>
							<div class="submit-button">
								<button class ="button" onclick="CreateDiv()" id="button-id">
									<img src="${arrowUri}" width="30px" height="30px">
								</button>
							</div>
						</div>
					</div>
					<script nonce="${nonce}">
						const userUri = "${userUri}";
						const botUri = "${botUri}";
						const copyUri = "${copyUri}";
						const tickUri = "${tickUri}";
					</script>
					<script nonce="${nonce}" src="${scriptUri}"></script>
				</body>
				</html>`;
	}
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
