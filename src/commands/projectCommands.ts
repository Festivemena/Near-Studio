import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AccountManagerProvider } from '../providers/AccountManagerProvider';

export function registerProjectCommands(accountManagerProvider: AccountManagerProvider): vscode.Disposable[] {
    return [
        vscode.commands.registerCommand('near-studio.initializeProject', initializeProject),
        vscode.commands.registerCommand('near-studio.setupRustToolchain', setupRustToolchain),
    ];
}

async function initializeProject() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Please open a workspace first');
        return;
    }

    const projectTypes = [
        { label: 'Rust Project', description: 'Initialize a new Rust-based NEAR project', value: 'rust' },
        { label: 'JavaScript Project', description: 'Initialize a new JavaScript-based NEAR project', value: 'javascript' },
        { label: 'TypeScript Project', description: 'Initialize a new TypeScript-based NEAR project', value: 'typescript' }
    ];

    const selected = await vscode.window.showQuickPick(projectTypes, { placeHolder: 'Select project type' });
    if (!selected) return;

    const terminal = vscode.window.createTerminal('Near Init');
    switch (selected.value) {
        case 'rust':
            terminal.sendText('cargo init --lib');
            break;
        case 'javascript':
            terminal.sendText('npm init -y && npm install near-sdk-js');
            break;
        case 'typescript':
            terminal.sendText('npm init -y && npm install near-sdk-js && npm install -D typescript @types/node');
            break;
    }
    terminal.show();

    setTimeout(() => {
        vscode.window.showInformationMessage(`Near ${selected.value} project initialized! You can now create contracts.`);
    }, 3000);
}

async function setupRustToolchain() {
    const terminal = vscode.window.createTerminal('Rust Setup');
    terminal.sendText('echo "Setting up Rust toolchain for NEAR development..."');
    terminal.sendText('rustup target add wasm32-unknown-unknown');
    terminal.sendText('cargo install cargo-near');
    terminal.sendText('echo "Rust toolchain setup complete!"');
    terminal.show();

    vscode.window.showInformationMessage('Setting up Rust toolchain for NEAR development...');
}
