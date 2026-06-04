import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {debugFileLoop} from './deBugger.js';

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

		const resolveWorkspacePath = (filePath: string): string => {
			if (!path.isAbsolute(filePath)) {
				const folders = vscode.workspace.workspaceFolders;
				if (folders && folders.length > 0) {
					return path.resolve(folders[0].uri.fsPath, filePath);
				}
			}
			return filePath;
		};

		webviewView.webview.onDidReceiveMessage(message => {
            if (message.command === "readFile") {
                try {
                    const resolvedPath = resolveWorkspacePath(message.path);
                    const content = fs.readFileSync(resolvedPath, 'utf8');
                    webviewView.webview.postMessage({
                        command: 'fileData',
                        path: message.path,
                        content: content
                    });
                } catch (error: any) {
                    vscode.window.showErrorMessage(`Failed to load file: ${error.message}`);
                    webviewView.webview.postMessage({
                        command: 'fileData',
                        path: message.path,
                        error: error.message
                    });
                }
            }
        });

		webviewView.webview.onDidReceiveMessage(message => {
			if(message.command === "writeFile"){
				try{
					const resolvedPath = resolveWorkspacePath(message.path);
					fs.writeFileSync(resolvedPath,message.content);
				}
				catch(error){
					vscode.window.showErrorMessage(`Failed to load file: ${error}`);
				}
			}
		});	

		webviewView.webview.onDidReceiveMessage(async message => {
			if (message.command === "findFilePath") {
				try {
					const files = await vscode.workspace.findFiles(`**/${message.fileName}`);
					if (files && files.length > 0) {
						webviewView.webview.postMessage({
							command: 'filePathResponse',
							fileName: message.fileName,
							filePath: files[0].fsPath
						});
					} else {
						webviewView.webview.postMessage({
							command: 'filePathResponse',
							fileName: message.fileName,
							filePath: undefined
						});
					}
				} catch (error: any) {
					vscode.window.showErrorMessage(`Failed to find file: ${error.message}`);
					webviewView.webview.postMessage({
						command: 'filePathResponse',
						fileName: message.fileName,
						error: error.message
					});
				}
			}
		});

		webviewView.webview.onDidReceiveMessage(async message =>{
			if(message.command === "debugFile"){
				try{
					const resolvedPath = resolveWorkspacePath(message.path);
					const res = await debugFileLoop(resolvedPath, (status) => {
						webviewView.webview.postMessage({
							command: 'debugStatus',
							path: message.path,
							msg: status
						});
					});
					webviewView.webview.postMessage({
                        command: 'debugresponse',
						path: message.path,
                        msg: res.message
                    });
				}catch(error: any){
					vscode.window.showErrorMessage("Failed to debug code");
					webviewView.webview.postMessage({
                        command: 'debugresponse',
                        path: message.path,
                        error: error.message
                    });
				}
			}
		});
	}

	private _getHtmlForWebview(webview: vscode.Webview) {

		const arrowUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri,'media','arrow-up-svgrepo-com.svg'));
		const userUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri,'media','user-3-svgrepo-com.svg'));
		const botUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri,'media','bot-svgrepo-com.svg'));
		const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri,'media','style.css'));
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri,'media','script.js'));
		const bulbUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri,'media','light-bulb-13-svgrepo-com.svg'));
		const copyUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri,'media','copy-svgrepo-com.svg'));
		const tickUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri,'media','tick-svgrepo-com.svg'));
		const plusUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri,'media','plus-svgrepo-com.svg'));
		const fileUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri,'media','test.txt'));
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
                    				<img src="${bulbUri}" width="26px" height="30px" alt="Theme Toggle">
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
						const vscodet = "${vscode}";
						const path = "${path}";
						const userUri = "${userUri}";
						const botUri = "${botUri}";
						const copyUri = "${copyUri}";
						const tickUri = "${tickUri}";
						const fileUri = "${fileUri}";
					</script>
					<script type="module" nonce="${nonce}" src="${scriptUri}"></script>
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
