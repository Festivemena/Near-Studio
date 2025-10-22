"use strict";
// src/commands/contractCommands.ts - Rust Smart Contracts Only
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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerContractCommands = registerContractCommands;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function registerContractCommands() {
    return [
        vscode.commands.registerCommand('near-studio.createContract', createRustContract),
        vscode.commands.registerCommand('near-studio.createRustContract', createRustContract),
        vscode.commands.registerCommand('near-studio.buildContract', buildContract),
        vscode.commands.registerCommand('near-studio.testContract', testContract),
        vscode.commands.registerCommand('near-studio.deployContract', deployContract),
        vscode.commands.registerCommand('near-studio.deployContractNewAccount', deployContractNewAccount),
    ];
}
/**
 * Create a new Rust smart contract using cargo near new
 */
async function createRustContract() {
    const projectName = await vscode.window.showInputBox({
        prompt: 'Enter project name for your Rust smart contract',
        placeHolder: 'my-contract',
        validateInput: (value) => {
            if (!value) {
                return 'Project name is required';
            }
            if (!/^[a-z0-9_-]+$/.test(value)) {
                return 'Use only lowercase letters, numbers, hyphens, and underscores';
            }
            return null;
        }
    });
    if (!projectName)
        return;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Please open a workspace folder first');
        return;
    }
    const targetPath = path.join(workspaceFolder.uri.fsPath, projectName);
    // Check if directory already exists
    if (fs.existsSync(targetPath)) {
        const overwrite = await vscode.window.showWarningMessage(`Directory "${projectName}" already exists. Choose a different name.`, 'OK');
        return;
    }
    // Check if cargo-near is installed
    const cargoNearInstalled = await checkCargoNearInstalled();
    if (!cargoNearInstalled) {
        const install = await vscode.window.showWarningMessage('cargo-near is not installed. Install it now?', 'Install', 'Cancel');
        if (install === 'Install') {
            const terminal = vscode.window.createTerminal('Install cargo-near');
            terminal.sendText('cargo install cargo-near');
            terminal.show();
            vscode.window.showInformationMessage('Installing cargo-near... Run the create command again after installation completes.');
        }
        return;
    }
    // Create the contract using cargo near new
    const terminal = vscode.window.createTerminal('NEAR Create Contract');
    terminal.sendText(`cd "${workspaceFolder.uri.fsPath}" && cargo near new ${projectName}`);
    terminal.show();
    vscode.window.showInformationMessage(`Creating Rust contract "${projectName}". The folder will open automatically once created.`);
    // Automatically open the new contract folder after creation
    // Wait for the folder to be created by cargo near new
    setTimeout(() => {
        if (fs.existsSync(targetPath)) {
            vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(targetPath));
            // Switch terminal to the new contract directory
            setTimeout(() => {
                terminal.sendText(`cd "${targetPath}"`);
            }, 500);
        }
        else {
            // If folder doesn't exist yet, wait a bit longer
            setTimeout(() => {
                if (fs.existsSync(targetPath)) {
                    vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(targetPath));
                    // Switch terminal to the new contract directory
                    setTimeout(() => {
                        terminal.sendText(`cd "${targetPath}"`);
                    }, 500);
                }
                else {
                    vscode.window.showWarningMessage(`Contract folder "${projectName}" not found. It may still be creating. Check the terminal.`);
                }
            }, 3000);
        }
    }, 2000);
}
/**
 * Build the Rust contract using cargo near build
 */
async function buildContract() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Open a workspace folder first');
        return;
    }
    // Check if this is a Rust project
    const cargoTomlPath = path.join(workspaceFolder.uri.fsPath, 'Cargo.toml');
    if (!fs.existsSync(cargoTomlPath)) {
        vscode.window.showErrorMessage('No Cargo.toml found. This does not appear to be a Rust project.');
        return;
    }
    const terminal = vscode.window.createTerminal('NEAR Build');
    terminal.sendText('cargo near build');
    terminal.show();
    vscode.window.showInformationMessage('Building contract...');
}
/**
 * Test the Rust contract using cargo test
 */
async function testContract() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Open a workspace folder first');
        return;
    }
    // Check if this is a Rust project
    const cargoTomlPath = path.join(workspaceFolder.uri.fsPath, 'Cargo.toml');
    if (!fs.existsSync(cargoTomlPath)) {
        vscode.window.showErrorMessage('No Cargo.toml found. This does not appear to be a Rust project.');
        return;
    }
    const terminal = vscode.window.createTerminal('NEAR Test');
    terminal.sendText('cargo test');
    terminal.show();
    vscode.window.showInformationMessage('Running tests...');
}
/**
 * Deploy contract to an existing account
 */
async function deployContract() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Open a workspace folder first');
        return;
    }
    // Check if contract is built
    const nearDir = path.join(workspaceFolder.uri.fsPath, 'target', 'near');
    if (!fs.existsSync(nearDir)) {
        const build = await vscode.window.showWarningMessage('Contract not built. Build now?', 'Yes', 'No');
        if (build === 'Yes') {
            await buildContract();
            vscode.window.showInformationMessage('Build the contract first, then run deploy again.');
        }
        return;
    }
    // Get account ID from user
    const accountId = await vscode.window.showInputBox({
        prompt: 'Enter the account ID to deploy to',
        placeHolder: 'your-account.testnet',
        validateInput: (value) => {
            if (!value) {
                return 'Account ID is required';
            }
            if (!value.includes('.')) {
                return 'Account ID should include network suffix (e.g., .testnet or .near)';
            }
            return null;
        }
    });
    if (!accountId)
        return;
    // Choose network
    const network = accountId.endsWith('.testnet') ? 'testnet' :
        accountId.endsWith('.near') ? 'mainnet' : 'testnet';
    const terminal = vscode.window.createTerminal('NEAR Deploy');
    terminal.sendText(`cargo near deploy ${accountId}`);
    terminal.show();
    vscode.window.showInformationMessage(`Deploying to ${accountId} on ${network}...`);
}
/**
 * Deploy contract to a new randomly generated dev account
 */
async function deployContractNewAccount() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Open a workspace folder first');
        return;
    }
    // Check if contract is built
    const nearDir = path.join(workspaceFolder.uri.fsPath, 'target', 'near');
    if (!fs.existsSync(nearDir)) {
        const build = await vscode.window.showWarningMessage('Contract not built. Build now?', 'Yes', 'No');
        if (build === 'Yes') {
            await buildContract();
            vscode.window.showInformationMessage('Build the contract first, then run deploy again.');
        }
        return;
    }
    // Confirm deployment
    const confirm = await vscode.window.showInformationMessage('This will create a new dev account and deploy the contract to it.', 'Deploy', 'Cancel');
    if (confirm !== 'Deploy')
        return;
    const terminal = vscode.window.createTerminal('NEAR Deploy Dev Account');
    terminal.sendText('cargo near deploy --without-init-call');
    terminal.show();
    vscode.window.showInformationMessage('Creating dev account and deploying contract... Check terminal for the new account ID.');
}
/**
 * Check if cargo-near is installed
 */
async function checkCargoNearInstalled() {
    try {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        await execAsync('cargo near --version');
        return true;
    }
    catch (error) {
        return false;
    }
}
//# sourceMappingURL=contractCommands.js.map