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
exports.ContractManagerProvider = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class ContractManagerProvider {
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
        // Handle messages FROM the webview
        webviewView.webview.onDidReceiveMessage(message => {
            switch (message.type) {
                case 'ready':
                    this._updateContractList();
                    break;
                case 'selectContract':
                    this._selectContract(message.path);
                    break;
                case 'refreshContracts':
                    this._updateContractList();
                    break;
            }
        }, undefined, []);
        // Set up file system watchers
        this._setupFileWatchers();
        // Listen for workspace changes
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            this._setupFileWatchers(); // Re-setup watchers for new folders
            this._updateContractList();
        });
        // Listen for file creation/deletion events
        vscode.workspace.onDidCreateFiles((event) => {
            const hasRelevantFiles = event.files.some(file => file.fsPath.endsWith('Cargo.toml') ||
                file.fsPath.endsWith('package.json') ||
                file.fsPath.endsWith('asconfig.json'));
            if (hasRelevantFiles) {
                setTimeout(() => this._updateContractList(), 500); // Small delay to ensure files are written
            }
        });
        vscode.workspace.onDidDeleteFiles((event) => {
            const hasRelevantFiles = event.files.some(file => file.fsPath.endsWith('Cargo.toml') ||
                file.fsPath.endsWith('package.json') ||
                file.fsPath.endsWith('asconfig.json'));
            if (hasRelevantFiles) {
                this._updateContractList();
            }
        });
        // Also listen for file changes to update contract status
        vscode.workspace.onDidSaveTextDocument((document) => {
            if (document.fileName.endsWith('Cargo.toml') ||
                document.fileName.endsWith('package.json') ||
                document.fileName.endsWith('asconfig.json')) {
                setTimeout(() => this._updateContractList(), 200);
            }
        });
    }
    _setupFileWatchers() {
        // Dispose existing watcher
        if (this._fileWatcher) {
            this._fileWatcher.dispose();
        }
        // Create new file system watcher for contract-related files
        this._fileWatcher = vscode.workspace.createFileSystemWatcher('**/{Cargo.toml,package.json,asconfig.json}', false, // Don't ignore creates
        false, // Don't ignore changes  
        false // Don't ignore deletes
        );
        this._fileWatcher.onDidCreate(() => {
            setTimeout(() => this._updateContractList(), 500);
        });
        this._fileWatcher.onDidChange(() => {
            setTimeout(() => this._updateContractList(), 200);
        });
        this._fileWatcher.onDidDelete(() => {
            this._updateContractList();
        });
    }
    dispose() {
        if (this._fileWatcher) {
            this._fileWatcher.dispose();
        }
    }
    _updateContractList() {
        if (!this._view) {
            return;
        }
        const contracts = this._findContracts();
        setTimeout(() => {
            this._view?.webview.postMessage({
                type: 'updateContracts',
                contracts: contracts.map(c => ({
                    ...c,
                    uri: vscode.Uri.file(c.path).toString()
                }))
            });
        }, 100);
    }
    _selectContract(contractUri) {
        const uri = vscode.Uri.parse(contractUri);
        vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: false });
        vscode.window.showInformationMessage(`Selected contract: ${path.basename(uri.fsPath)}`);
    }
    _findContracts() {
        const contracts = [];
        if (vscode.workspace.workspaceFolders) {
            for (const folder of vscode.workspace.workspaceFolders) {
                // Check for contracts in the root folder
                this._checkFolderForContracts(folder.uri.fsPath, contracts);
                // Also check subfolders (1 level deep) for contracts
                try {
                    const items = fs.readdirSync(folder.uri.fsPath);
                    for (const item of items) {
                        const itemPath = path.join(folder.uri.fsPath, item);
                        if (fs.statSync(itemPath).isDirectory() && !item.startsWith('.')) {
                            this._checkFolderForContracts(itemPath, contracts);
                        }
                    }
                }
                catch (error) {
                    console.error('Error reading directory:', error);
                }
            }
        }
        return contracts;
    }
    _checkFolderForContracts(folderPath, contracts) {
        const cargoToml = path.join(folderPath, 'Cargo.toml');
        const packageJson = path.join(folderPath, 'package.json');
        const asconfigJson = path.join(folderPath, 'asconfig.json');
        if (fs.existsSync(cargoToml)) {
            try {
                const cargoContent = fs.readFileSync(cargoToml, 'utf8');
                if (cargoContent.includes('near-sdk') || cargoContent.includes('wasm32')) {
                    contracts.push({
                        name: path.basename(folderPath),
                        type: 'Rust',
                        path: folderPath,
                        status: this._getContractStatus(folderPath, 'rust')
                    });
                }
            }
            catch (error) {
                console.error('Error reading Cargo.toml:', error);
            }
        }
        if (fs.existsSync(packageJson)) {
            try {
                const packageContent = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
                if (packageContent.dependencies?.['near-sdk-js'] ||
                    packageContent.devDependencies?.['near-sdk-js'] ||
                    packageContent.scripts?.build?.includes('near') ||
                    packageContent.name?.includes('near')) {
                    contracts.push({
                        name: path.basename(folderPath),
                        type: 'JavaScript/TypeScript',
                        path: folderPath,
                        status: this._getContractStatus(folderPath, 'js')
                    });
                }
            }
            catch (error) {
                console.error('Error reading package.json:', error);
            }
        }
        if (fs.existsSync(asconfigJson)) {
            contracts.push({
                name: path.basename(folderPath),
                type: 'AssemblyScript',
                path: folderPath,
                status: this._getContractStatus(folderPath, 'as')
            });
        }
    }
    _getContractStatus(contractPath, type) {
        const buildPaths = {
            'rust': path.join(contractPath, 'target', 'wasm32-unknown-unknown', 'release'),
            'js': path.join(contractPath, 'build'),
            'as': path.join(contractPath, 'build')
        };
        const buildPath = buildPaths[type];
        if (buildPath && fs.existsSync(buildPath)) {
            const files = fs.readdirSync(buildPath);
            if (files.some(file => file.endsWith('.wasm'))) {
                return 'Built';
            }
        }
        return 'Not Built';
    }
    _getHtmlForWebview(webview) {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
                    
                    function selectContract(contractPath) {
                        vscode.postMessage({
                            type: 'selectContract',
                            path: contractPath
                        });
                    }
                    
                    function refreshContracts() {
                        vscode.postMessage({
                            type: 'refreshContracts'
                        });
                        document.getElementById('contracts-list').innerHTML = '<p class="loading">🔄 Refreshing contracts...</p>';
                    }
                    
                    // Make functions available globally
                    window.selectContract = selectContract;
                    window.refreshContracts = refreshContracts;
                })();
            </script>
        </body>
        </html>`;
    }
}
exports.ContractManagerProvider = ContractManagerProvider;
ContractManagerProvider.viewType = 'near-studio.contractManager';
//# sourceMappingURL=ContractManagerProvider.js.map