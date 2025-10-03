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
                    vscode.commands.executeCommand('near-studio.createContract');
                    break;
                case 'buildAndDeployExisting':
                    this._handleBuildAndDeployExisting();
                    break;
                case 'buildAndDeploySelect':
                    this._handleBuildAndDeploySelect();
                    break;
                case 'toggleBuildDeploy':
                    // Toggle the build & deploy options visibility
                    this._view?.webview.postMessage({ type: 'toggleBuildDeploy' });
                    break;
            }
        });
    }

    private async _handleBuildAndDeployExisting() {
        // Deploy to existing account - user inputs account ID directly
        const accountId = await vscode.window.showInputBox({
            prompt: 'Enter existing account ID to deploy to',
            placeHolder: 'your-account.testnet or your-account.near',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Account ID is required';
                }
                if (!value.includes('.')) {
                    return 'Account ID should include network (.testnet or .near)';
                }
                return null;
            }
        });

        if (!accountId) return;

        // Execute cargo near deploy command with specific account
        const terminal = vscode.window.createTerminal('NEAR Build & Deploy');
        terminal.sendText(`cargo near deploy build-non-reproducible-wasm ${accountId.trim()}`);
        terminal.show();

        // Parse ABI after deployment
        setTimeout(() => {
            this._parseContractABI(accountId.trim());
        }, 5000); // Wait 5 seconds for deployment to complete
    }

    private async _handleBuildAndDeploySelect() {
        // Get list of available accounts from AccountManagerProvider and let user select
        const config = vscode.workspace.getConfiguration('near-studio');
        const accounts = config.get<any>('accounts') || {};
        
        if (Object.keys(accounts).length === 0) {
            vscode.window.showErrorMessage('No NEAR accounts found. Please add an account first using the Account Manager.');
            return;
        }

        // Create account options list
        const accountOptions = Object.entries(accounts).map(([id, account]: [string, any]) => ({
            label: id,
            description: `${account.network}`,
            detail: account.balance || 'Loading...'
        }));

        const selectedAccount = await vscode.window.showQuickPick(accountOptions, {
            placeHolder: 'Select an account to deploy to'
        });

        if (!selectedAccount) return;

        // Execute cargo near deploy command with specific account
        const terminal = vscode.window.createTerminal('NEAR Build & Deploy');
        terminal.sendText(`cargo near deploy build-non-reproducible-wasm ${selectedAccount.label}`);
        terminal.show();

        // Parse ABI after deployment
        setTimeout(() => {
            this._parseContractABI(selectedAccount.label);
        }, 5000); // Wait 5 seconds for deployment to complete
    }

    private async _parseContractABI(accountId?: string) {
        try {
            // Check if ABI file exists in the typical location
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) return;

            const fs = require('fs');
            const path = require('path');
            
            // Look for ABI files in common locations
            const possibleAbiPaths = [
                path.join(workspaceFolder.uri.fsPath, 'target', 'near', '*.json'),
                path.join(workspaceFolder.uri.fsPath, 'out', '*.json'),
                path.join(workspaceFolder.uri.fsPath, 'build', '*.json')
            ];

            let abiContent = null;
            let abiPath = null;

            // Try to find ABI file
            for (const pathPattern of possibleAbiPaths) {
                const dirPath = path.dirname(pathPattern);
                if (fs.existsSync(dirPath)) {
                    const files = fs.readdirSync(dirPath).filter((f: string) => f.endsWith('.json'));
                    if (files.length > 0) {
                        abiPath = path.join(dirPath, files[0]);
                        try {
                            abiContent = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
                            break;
                        } catch (error) {
                            console.log('Failed to parse ABI file:', error);
                        }
                    }
                }
            }

            if (abiContent && abiPath) {
                // Show success message and offer to open contract interface
                const action = await vscode.window.showInformationMessage(
                    `Contract deployed successfully${accountId ? ` to ${accountId}` : ''}! Contract ABI parsed.`,
                    'Open Contract Interface',
                    'View ABI'
                );

                if (action === 'Open Contract Interface') {
                    this._openContractInterface(abiContent, accountId);
                } else if (action === 'View ABI') {
                    const doc = await vscode.workspace.openTextDocument({
                        content: JSON.stringify(abiContent, null, 2),
                        language: 'json'
                    });
                    vscode.window.showTextDocument(doc);
                }
            } else {
                vscode.window.showWarningMessage('Contract deployed but ABI file not found. You may need to manually locate the contract interface.');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to parse contract ABI: ${error}`);
        }
    }

    private async _openContractInterface(abiContent: any, accountId?: string) {
        // Create a new webview panel for contract interaction
        const panel = vscode.window.createWebviewPanel(
            'nearContractInterface',
            `NEAR Contract Interface${accountId ? ` - ${accountId}` : ''}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = this._getContractInterfaceHtml(abiContent, accountId);
        
        // Handle messages from the contract interface
        panel.webview.onDidReceiveMessage(message => {
            switch (message.type) {
                case 'callMethod':
                    this._callContractMethod(message.method, message.args, accountId);
                    break;
                case 'viewMethod':
                    this._viewContractMethod(message.method, message.args, accountId);
                    break;
            }
        });
    }

    private async _callContractMethod(method: string, args: any, accountId?: string) {
        const terminal = vscode.window.createTerminal('NEAR Contract Call');
        const argsString = args ? `'${JSON.stringify(args)}'` : '{}';
        const accountParam = accountId ? `--accountId ${accountId}` : '';
        
        terminal.sendText(`near call ${accountId || 'CONTRACT_ADDRESS'} ${method} ${argsString} ${accountParam}`);
        terminal.show();
    }

    private async _viewContractMethod(method: string, args: any, accountId?: string) {
        const terminal = vscode.window.createTerminal('NEAR Contract View');
        const argsString = args ? `'${JSON.stringify(args)}'` : '{}';
        
        terminal.sendText(`near view ${accountId || 'CONTRACT_ADDRESS'} ${method} ${argsString}`);
        terminal.show();
    }

    private _getContractInterfaceHtml(abiContent: any, accountId?: string): string {
        const methods = abiContent.body?.functions || [];
        const viewMethods = methods.filter((m: any) => m.kind === 'view');
        const callMethods = methods.filter((m: any) => m.kind === 'call');

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>NEAR Contract Interface</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    padding: 20px;
                }
                .method-group {
                    margin-bottom: 30px;
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 4px;
                    padding: 15px;
                }
                .method-group h3 {
                    margin-top: 0;
                    color: var(--vscode-textLink-foreground);
                }
                .method {
                    margin-bottom: 20px;
                    padding: 10px;
                    border-left: 3px solid var(--vscode-textLink-foreground);
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                }
                .method h4 {
                    margin-top: 0;
                    color: var(--vscode-symbolIcon-functionForeground);
                }
                .method-params {
                    margin: 10px 0;
                }
                .param-input {
                    width: 100%;
                    padding: 5px;
                    margin: 5px 0;
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 2px;
                }
                .call-button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 6px 12px;
                    border-radius: 2px;
                    cursor: pointer;
                    margin-right: 10px;
                }
                .call-button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .view-button {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    border: none;
                    padding: 6px 12px;
                    border-radius: 2px;
                    cursor: pointer;
                }
                .view-button:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                }
            </style>
        </head>
        <body>
            <h2>Contract Interface${accountId ? ` - ${accountId}` : ''}</h2>
            
            ${viewMethods.length > 0 ? `
            <div class="method-group">
                <h3>📖 View Methods (Read-only)</h3>
                ${viewMethods.map((method: any) => `
                <div class="method">
                    <h4>${method.name}</h4>
                    <div class="method-params">
                        ${method.params ? method.params.map((param: any) => `
                            <div>
                                <label>${param.name} (${param.type_schema?.type || param.type})</label>
                                <input type="text" class="param-input" id="view-${method.name}-${param.name}" placeholder="Enter ${param.name}">
                            </div>
                        `).join('') : '<p>No parameters</p>'}
                    </div>
                    <button class="view-button" onclick="callViewMethod('${method.name}')">View</button>
                </div>
                `).join('')}
            </div>
            ` : ''}
            
            ${callMethods.length > 0 ? `
            <div class="method-group">
                <h3>✍️ Call Methods (State-changing)</h3>
                ${callMethods.map((method: any) => `
                <div class="method">
                    <h4>${method.name}</h4>
                    <div class="method-params">
                        ${method.params ? method.params.map((param: any) => `
                            <div>
                                <label>${param.name} (${param.type_schema?.type || param.type})</label>
                                <input type="text" class="param-input" id="call-${method.name}-${param.name}" placeholder="Enter ${param.name}">
                            </div>
                        `).join('') : '<p>No parameters</p>'}
                    </div>
                    <button class="call-button" onclick="callContractMethod('${method.name}')">Call</button>
                </div>
                `).join('')}
            </div>
            ` : ''}

            <script>
                const vscode = acquireVsCodeApi();
                
                function callViewMethod(methodName) {
                    const args = {};
                    const inputs = document.querySelectorAll('input[id^="view-' + methodName + '-"]');
                    inputs.forEach(input => {
                        const paramName = input.id.split('-').slice(2).join('-'); // Remove 'view-methodName-' prefix
                        if (input.value) {
                            try {
                                args[paramName] = JSON.parse(input.value);
                            } catch {
                                args[paramName] = input.value;
                            }
                        }
                    });
                    
                    vscode.postMessage({
                        type: 'viewMethod',
                        method: methodName,
                        args: Object.keys(args).length > 0 ? args : null
                    });
                }
                
                function callContractMethod(methodName) {
                    const args = {};
                    const inputs = document.querySelectorAll('input[id^="call-' + methodName + '-"]');
                    inputs.forEach(input => {
                        const paramName = input.id.split('-').slice(2).join('-'); // Remove 'call-methodName-' prefix
                        if (input.value) {
                            try {
                                args[paramName] = JSON.parse(input.value);
                            } catch {
                                args[paramName] = input.value;
                            }
                        }
                    });
                    
                    vscode.postMessage({
                        type: 'callMethod',
                        method: methodName,
                        args: Object.keys(args).length > 0 ? args : null
                    });
                }
            </script>
        </body>
        </html>`;
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
                .main-button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 12px 16px;
                    margin: 8px 0;
                    width: 100%;
                    cursor: pointer;
                    border-radius: 4px;
                    font-size: 14px;
                    font-weight: 500;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background-color 0.2s;
                }
                .main-button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .build-deploy-container {
                    position: relative;
                    width: 100%;
                }
                .dropdown-arrow {
                    margin-left: 8px;
                    font-size: 12px;
                    transition: transform 0.2s;
                }
                .dropdown-arrow.expanded {
                    transform: rotate(180deg);
                }
                .deploy-options {
                    display: none;
                    background-color: var(--vscode-sideBar-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 4px;
                    margin-top: 4px;
                    overflow: hidden;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                .deploy-options.visible {
                    display: block;
                }
                .deploy-option {
                    background-color: var(--vscode-list-inactiveSelectionBackground);
                    color: var(--vscode-foreground);
                    border: none;
                    padding: 10px 16px;
                    width: 100%;
                    cursor: pointer;
                    text-align: left;
                    font-size: 13px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                }
                .deploy-option:last-child {
                    border-bottom: none;
                }
                .deploy-option:hover {
                    background-color: var(--vscode-list-hoverBackground);
                }
                .option-title {
                    font-weight: 500;
                    margin-bottom: 2px;
                }
                .option-description {
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                }
                .section {
                    margin-bottom: 20px;
                }
                .section-title {
                    font-weight: bold;
                    margin-bottom: 12px;
                    color: var(--vscode-sideBarSectionHeader-foreground);
                    font-size: 13px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
            </style>
        </head>
        <body>
            <div class="section">
                <div class="section-title">Quick Actions</div>
                
                <button class="main-button" onclick="createContract()">
                    🚀 Create New Contract
                </button>
                
                <div class="build-deploy-container">
                    <button class="main-button" onclick="toggleBuildDeploy()">
                        🔨 Build & Deploy
                        <span class="dropdown-arrow" id="dropdown-arrow">▼</span>
                    </button>
                    
                    <div class="deploy-options" id="deploy-options">
                        <button class="deploy-option" onclick="buildAndDeployExisting()">
                            <div class="option-title">📝 Existing Account</div>
                            <div class="option-description">Enter account ID manually</div>
                        </button>
                        <button class="deploy-option" onclick="buildAndDeploySelect()">
                            <div class="option-title">📋 Select Account</div>
                            <div class="option-description">Choose from saved accounts</div>
                        </button>
                    </div>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                let isDropdownOpen = false;
                
                function createContract() {
                    vscode.postMessage({
                        type: 'createContract'
                    });
                }
                
                function toggleBuildDeploy() {
                    const options = document.getElementById('deploy-options');
                    const arrow = document.getElementById('dropdown-arrow');
                    
                    isDropdownOpen = !isDropdownOpen;
                    
                    if (isDropdownOpen) {
                        options.classList.add('visible');
                        arrow.classList.add('expanded');
                    } else {
                        options.classList.remove('visible');
                        arrow.classList.remove('expanded');
                    }
                }
                
                function buildAndDeployExisting() {
                    closeDropdown();
                    vscode.postMessage({
                        type: 'buildAndDeployExisting'
                    });
                }
                
                function buildAndDeploySelect() {
                    closeDropdown();
                    vscode.postMessage({
                        type: 'buildAndDeploySelect'
                    });
                }
                
                function closeDropdown() {
                    const options = document.getElementById('deploy-options');
                    const arrow = document.getElementById('dropdown-arrow');
                    options.classList.remove('visible');
                    arrow.classList.remove('expanded');
                    isDropdownOpen = false;
                }
                
                // Close dropdown when clicking outside
                document.addEventListener('click', function(event) {
                    const container = document.querySelector('.build-deploy-container');
                    if (!container.contains(event.target) && isDropdownOpen) {
                        closeDropdown();
                    }
                });
            </script>
        </body>
        </html>`;
    }
}