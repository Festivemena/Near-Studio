import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AccountManagerProvider } from '../providers/AccountManagerProvider';

export function registerProjectCommands(accountManagerProvider: AccountManagerProvider): vscode.Disposable[] {
    return [
        vscode.commands.registerCommand('nearExtension.initializeProject', initializeProject),
        vscode.commands.registerCommand('nearExtension.setupRustToolchain', setupRustToolchain),
        vscode.commands.registerCommand('nearExtension.optimizeContract', optimizeContract),
        vscode.commands.registerCommand('nearExtension.generateBindings', generateBindings),
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

async function optimizeContract() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
    }

    const optimizeScript = path.join(workspaceFolder.uri.fsPath, 'optimize.sh');
    const terminal = vscode.window.createTerminal('Near Optimize');

    if (fs.existsSync(optimizeScript)) {
        terminal.sendText('./optimize.sh');
    } else {
        terminal.sendText('cargo build --target wasm32-unknown-unknown --release');
        terminal.sendText('if command -v wasm-opt &> /dev/null; then wasm-opt -Oz target/wasm32-unknown-unknown/release/*.wasm --output optimized.wasm; fi');
    }

    terminal.show();
    vscode.window.showInformationMessage('Optimizing contract for production...');
}

async function generateBindings() {
    const bindingTypes = [
        { label: 'TypeScript Bindings', description: 'Generate TypeScript interface for contract calls' },
        { label: 'JavaScript Bindings', description: 'Generate JavaScript helpers for contract interaction' },
        { label: 'Rust Bindings', description: 'Generate Rust client code for cross-contract calls' }
    ];

    const selected = await vscode.window.showQuickPick(bindingTypes, { placeHolder: 'Select binding type to generate' });
    if (!selected) return;

    vscode.window.showInformationMessage(`Generating ${selected.label} (feature coming soon)!`);
}
