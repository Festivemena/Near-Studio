"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectExplorerProvider = void 0;
const vscode = __importStar(require("vscode"));
class ProjectExplorerProvider {
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
    }
    resolveWebviewView(webviewView, context, _token) {
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
    _getHtmlForWebview(webview) {
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
exports.ProjectExplorerProvider = ProjectExplorerProvider;
ProjectExplorerProvider.viewType = 'near-studio.projectExplorer';
//# sourceMappingURL=ProjectExplorerProvider.js.map