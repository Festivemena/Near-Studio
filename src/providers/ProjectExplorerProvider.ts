import * as vscode from 'vscode';

export class ProjectExplorerProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'near-studio.projectExplorer';
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;
        
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'createContract':
                    vscode.commands.executeCommand('nearExtension.createContract');
                    break;
                case 'buildContract':
                    vscode.commands.executeCommand('nearExtension.buildContract');
                    break;
                case 'deployContract':
                    vscode.commands.executeCommand('nearExtension.deployContract');
                    break;
            }
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>NEAR Studio Project Explorer</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-sideBar-background);
                    padding: 10px;
                }
                .action-button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 16px;
                    margin: 4px 0;
                    width: 100%;
                    cursor: pointer;
                    border-radius: 2px;
                }
                .action-button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .section {
                    margin-bottom: 20px;
                }
                .section-title {
                    font-weight: bold;
                    margin-bottom: 8px;
                    color: var(--vscode-sideBarSectionHeader-foreground);
                }
            </style>
        </head>
        <body>
            <div class="section">
                <div class="section-title">Quick Actions</div>
                <button class="action-button" onclick="createContract()">
                    🚀 Create New Contract
                </button>
                <button class="action-button" onclick="buildContract()">
                    🔨 Build Contract
                </button>
                <button class="action-button" onclick="deployContract()">
                    📦 Deploy Contract
                </button>
            </div>
            
            <div class="section">
                <div class="section-title">Project Status</div>
                <div id="project-info">
                    <p>Ready to build NEAR contracts!</p>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                
                function createContract() {
                    vscode.postMessage({
                        type: 'createContract'
                    });
                }
                
                function buildContract() {
                    vscode.postMessage({
                        type: 'buildContract'
                    });
                }
                
                function deployContract() {
                    vscode.postMessage({
                        type: 'deployContract'
                    });
                }
            </script>
        </body>
        </html>`;
    }
}
