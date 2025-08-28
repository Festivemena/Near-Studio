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
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const util_1 = require("util");
const child_process_1 = require("child_process");
const ProjectExplorerProvider_1 = require("./providers/ProjectExplorerProvider");
const ContractManagerProvider_1 = require("./providers/ContractManagerProvider");
const AccountManagerProvider_1 = require("./providers/AccountManagerProvider");
const accountCommands_1 = require("./commands/accountCommands");
const contractCommands_1 = require("./commands/contractCommands");
const projectCommands_1 = require("./commands/projectCommands");
const NearTaskProvider_1 = require("./tasks/NearTaskProvider");
const fetch_1 = require("./utils/fetch");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
async function activate(context) {
    console.log('Near Smart Contracts extension activated');
    // Init providers
    const projectExplorerProvider = new ProjectExplorerProvider_1.ProjectExplorerProvider(context.extensionUri);
    const contractManagerProvider = new ContractManagerProvider_1.ContractManagerProvider(context.extensionUri);
    const accountManagerProvider = new AccountManagerProvider_1.AccountManagerProvider();
    // Register providers
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('near-studio.projectExplorer', projectExplorerProvider), vscode.window.registerWebviewViewProvider('near-studio.contractManager', contractManagerProvider), vscode.window.registerTreeDataProvider('near-studio.accountManager', accountManagerProvider), contractManagerProvider, accountManagerProvider);
    // Register commands modularly
    context.subscriptions.push(...(0, accountCommands_1.registerAccountCommands)(accountManagerProvider), ...(0, contractCommands_1.registerContractCommands)(), ...(0, projectCommands_1.registerProjectCommands)(accountManagerProvider));
    // Register task provider
    context.subscriptions.push(vscode.tasks.registerTaskProvider('near', new NearTaskProvider_1.NearTaskProvider()));
    // Check projects and tooling
    await checkForNearProject();
    await validateToolchains();
    // Polyfill fetch if needed
    if (!global.fetch) {
        global.fetch = fetch_1.fetch;
    }
}
exports.activate = activate;
function deactivate() {
    // Cleanup if needed
}
exports.deactivate = deactivate;
async function checkForNearProject() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder)
        return;
    const projectType = await detectProjectType(workspaceFolder.uri.fsPath);
    if (projectType) {
        vscode.window.showInformationMessage(`Near ${projectType} project detected! Use Near commands via Command Palette.`, 'Show Commands').then(selection => {
            if (selection === 'Show Commands') {
                vscode.commands.executeCommand('workbench.action.showCommands', 'Near:');
            }
        });
    }
}
async function detectProjectType(workspacePath) {
    const fs = await Promise.resolve().then(() => __importStar(require('fs')));
    const path = await Promise.resolve().then(() => __importStar(require('path')));
    if (fs.existsSync(path.join(workspacePath, 'Cargo.toml'))) {
        return 'rust';
    }
    const packageJsonPath = path.join(workspacePath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            if (pkg.dependencies?.['near-sdk-js']) {
                return pkg.devDependencies?.typescript ? 'typescript' : 'javascript';
            }
        }
        catch { }
    }
    return null;
}
async function validateToolchains() {
    const config = vscode.workspace.getConfiguration('nearExtension');
    if (!config.get('autoInstallDeps', true))
        return;
    try {
        await execAsync('near --version');
    }
    catch {
        const btn = await vscode.window.showWarningMessage('Near CLI not found. Install it for full functionality.', 'Install Near CLI', 'Ignore');
        if (btn === 'Install Near CLI') {
            const terminal = vscode.window.createTerminal('Install Near CLI');
            terminal.sendText('npm install -g near-cli');
            terminal.show();
        }
    }
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
        const projectType = await detectProjectType(workspaceFolder.uri.fsPath);
        if (projectType === 'rust') {
            try {
                await execAsync('rustc --version');
                await execAsync('cargo --version');
            }
            catch {
                const btn = await vscode.window.showWarningMessage('Rust toolchain not found. Install it for Rust contract development.', 'Install Rust', 'Ignore');
                if (btn === 'Install Rust') {
                    vscode.env.openExternal(vscode.Uri.parse('https://rustup.rs/'));
                }
            }
        }
    }
}
//# sourceMappingURL=extension.js.map