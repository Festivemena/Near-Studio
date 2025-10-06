// src/commands/contractCommands.ts - Rust Smart Contracts Only

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function registerContractCommands(): vscode.Disposable[] {
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

    if (!projectName) return;

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Please open a workspace folder first');
        return;
    }

    const targetPath = path.join(workspaceFolder.uri.fsPath, projectName);

    // Check if directory already exists
    if (fs.existsSync(targetPath)) {
        const overwrite = await vscode.window.showWarningMessage(
            `Directory "${projectName}" already exists. Choose a different name.`,
            'OK'
        );
        return;
    }

    // Check if cargo-near is installed
    const cargoNearInstalled = await checkCargoNearInstalled();
    if (!cargoNearInstalled) {
        const install = await vscode.window.showWarningMessage(
            'cargo-near is not installed. Install it now?',
            'Install', 'Cancel'
        );
        
        if (install === 'Install') {
            const terminal = vscode.window.createTerminal('Install cargo-near');
            terminal.sendText('cargo install cargo-near');
            terminal.show();
            vscode.window.showInformationMessage(
                'Installing cargo-near... Run the create command again after installation completes.'
            );
        }
        return;
    }

    // Create the contract using cargo near new
    const terminal = vscode.window.createTerminal('NEAR Create Contract');
    terminal.sendText(`cd "${workspaceFolder.uri.fsPath}" && cargo near new ${projectName}`);
    terminal.show();

    vscode.window.showInformationMessage(
        `Creating Rust contract "${projectName}". Check the terminal for progress.`,
        'Open Folder'
    ).then(selection => {
        if (selection === 'Open Folder') {
            // Wait a bit for the folder to be created
            setTimeout(() => {
                if (fs.existsSync(targetPath)) {
                    vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(targetPath));
                }
            }, 2000);
        }
    });
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
        const build = await vscode.window.showWarningMessage(
            'Contract not built. Build now?',
            'Yes', 'No'
        );
        
        if (build === 'Yes') {
            await buildContract();
            vscode.window.showInformationMessage(
                'Build the contract first, then run deploy again.'
            );
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

    if (!accountId) return;

    // Choose network
    const network = accountId.endsWith('.testnet') ? 'testnet' : 
                    accountId.endsWith('.near') ? 'mainnet' : 'testnet';

    const terminal = vscode.window.createTerminal('NEAR Deploy');
    terminal.sendText(`cargo near deploy ${accountId}`);
    terminal.show();

    vscode.window.showInformationMessage(
        `Deploying to ${accountId} on ${network}...`
    );
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
        const build = await vscode.window.showWarningMessage(
            'Contract not built. Build now?',
            'Yes', 'No'
        );
        
        if (build === 'Yes') {
            await buildContract();
            vscode.window.showInformationMessage(
                'Build the contract first, then run deploy again.'
            );
        }
        return;
    }

    // Confirm deployment
    const confirm = await vscode.window.showInformationMessage(
        'This will create a new dev account and deploy the contract to it.',
        'Deploy', 'Cancel'
    );

    if (confirm !== 'Deploy') return;

    const terminal = vscode.window.createTerminal('NEAR Deploy Dev Account');
    terminal.sendText('cargo near deploy --without-init-call');
    terminal.show();

    vscode.window.showInformationMessage(
        'Creating dev account and deploying contract... Check terminal for the new account ID.'
    );
}

/**
 * Check if cargo-near is installed
 */
async function checkCargoNearInstalled(): Promise<boolean> {
    try {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        await execAsync('cargo near --version');
        return true;
    } catch (error) {
        return false;
    }
}