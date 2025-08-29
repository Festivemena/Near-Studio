import * as vscode from 'vscode';
import * as path from 'path';
import { ContractService } from '../services/ContractService';
import { Contract } from '../models/Contract';

export class ContractManagerProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'near-studio.contractManager';

    private _view?: vscode.WebviewView;
    private _fileWatcher?: vscode.FileSystemWatcher;
    private _contractService = new ContractService();
    private _disposables: vscode.Disposable[] = [];

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

        webviewView.webview.onDidReceiveMessage(message => this._handleMessage(message), undefined, this._disposables);

        this._setupFileWatcher();

        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            this._setupFileWatcher();
            this._postContracts();
        }, null, this._disposables);

        vscode.workspace.onDidCreateFiles(event => {
            if(this._hasRelevantFiles(event.files)) {
                setTimeout(() => this._postContracts(), 500);
            }
        }, null, this._disposables);

        vscode.workspace.onDidDeleteFiles(event => {
            if(this._hasRelevantFiles(event.files)) {
                this._postContracts();
            }
        }, null, this._disposables);

        vscode.workspace.onDidSaveTextDocument(document => {
            if(this._isContractFile(document.fileName)) {
                setTimeout(() => this._postContracts(), 200);
            }
        }, null, this._disposables);
    }

    public dispose() {
        this._fileWatcher?.dispose();
        this._disposables.forEach(d => d.dispose());
        this._disposables.length = 0;
    }

    private _handleMessage(message: any) {
        switch(message.type) {
            case 'ready':
                this._postContracts();
                break;
            case 'selectContract':
                this._openContractFolder(message.path);
                break;
            case 'refreshContracts':
                this._postContracts();
                break;
        }
    }

    private _setupFileWatcher() {
        this._fileWatcher?.dispose();

        this._fileWatcher = vscode.workspace.createFileSystemWatcher('**/{Cargo.toml,package.json,asconfig.json}', false, false, false);

        this._fileWatcher.onDidCreate(() => setTimeout(() => this._postContracts(), 500));
        this._fileWatcher.onDidChange(() => setTimeout(() => this._postContracts(), 200));
        this._fileWatcher.onDidDelete(() => this._postContracts());
    }

    private _postContracts() {
        if (!this._view) return;

        const contracts: Contract[] = this._contractService.findContracts();

        this._view.webview.postMessage({
            type: 'updateContracts',
            contracts: contracts.map(c => ({
                ...c,
                uri: vscode.Uri.file(c.path).toString()
            }))
        });
    }

    private _openContractFolder(uriString: string) {
        const uri = vscode.Uri.parse(uriString);
        vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: false });
        vscode.window.showInformationMessage(`Selected contract: ${path.basename(uri.fsPath)}`);
    }

    private _hasRelevantFiles(files: readonly vscode.Uri[]): boolean {
        return files.some(file =>
            file.fsPath.endsWith('Cargo.toml') ||
            file.fsPath.endsWith('package.json') ||
            file.fsPath.endsWith('asconfig.json')
        );
    }

    private _isContractFile(fileName: string): boolean {
        return fileName.endsWith('Cargo.toml') ||
               fileName.endsWith('package.json') ||
               fileName.endsWith('asconfig.json');
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Same HTML structure as your original code, you can keep it as is — 
        // or extract to separate file/template if preferred.
        // Remember to adjust resource URIs by webview.asWebviewUri() if using external files.

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Contract Manager</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-sideBar-background);
            padding: 10px;
            margin: 0;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .refresh-button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            cursor: pointer;
            border-radius: 2px;
            font-size: 12px;
        }
        .refresh-button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .contract-item {
            padding: 12px;
            margin: 8px 0;
            border-left: 3px solid var(--vscode-activityBar-activeBorder);
            background-color: var(--vscode-sideBar-background);
            cursor: pointer;
            border-radius: 4px;
            transition: background-color 0.2s ease;
        }
        .contract-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .contract-name {
            font-weight: bold;
            margin-bottom: 4px;
            color: var(--vscode-sideBarTitle-foreground);
        }
        .contract-type {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 2px;
        }
        .contract-status {
            font-size: 11px;
            color: var(--vscode-charts-green);
            font-style: italic;
        }
        .status-not-built {
            color: var(--vscode-charts-orange);
        }
        .no-contracts {
            text-align: center;
            color: var(--vscode-descriptionForeground);
            padding: 20px;
        }
        .loading {
            text-align: center;
            color: var(--vscode-descriptionForeground);
            padding: 20px;
        }
    </style>
</head>
<body>
    <div class="header">
        <span>Contracts</span>
        <button class="refresh-button" onclick="refreshContracts()">🔄 Refresh</button>
    </div>
    <div id="contracts-list" class="loading">
        <p>🔍 Loading contracts...</p>
    </div>

    <script>
        (function() {
            const vscode = acquireVsCodeApi();
            
            vscode.postMessage({ type: 'ready' });
            
            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.type) {
                    case 'updateContracts':
                        updateContractsList(message.contracts);
                        break;
                }
            });
            
            function updateContractsList(contracts) {
                const container = document.getElementById('contracts-list');
                
                if (contracts.length === 0) {
                    container.className = 'no-contracts';
                    container.innerHTML = \`
                        <div>
                            <p>📄 No NEAR contracts found</p>
                            <small>Create a contract using the command palette</small>
                        </div>
                    \`;
                    return;
                }
                
                container.className = '';
                container.innerHTML = contracts.map(contract => {
                    const statusClass = contract.status === 'Built' ? '' : 'status-not-built';
                    const statusIcon = contract.status === 'Built' ? '✅' : '⚠️';
                    const typeIcon = contract.type === 'Rust' ? '🦀' : 
                                   contract.type === 'AssemblyScript' ? '⚡' : '📜';
                    
                    return \`
                        <div class="contract-item" onclick="selectContract('\${contract.uri}')">
                            <div class="contract-name">📦 \${contract.name}</div>
                            <div class="contract-type">\${typeIcon} \${contract.type}</div>
                            <div class="contract-status \${statusClass}">\${statusIcon} \${contract.status}</div>
                        </div>
                    \`;
                }).join('');
            }
            
            window.selectContract = function(contractPath) {
                vscode.postMessage({
                    type: 'selectContract',
                    path: contractPath
                });
            }
            
            window.refreshContracts = function() {
                vscode.postMessage({
                    type: 'refreshContracts'
                });
                document.getElementById('contracts-list').innerHTML = '<p class="loading">🔄 Refreshing contracts...</p>';
            }
        })();
    </script>
</body>
</html>`;
    }
}
