import * as vscode from 'vscode';
import { promisify } from 'util';
import { exec } from 'child_process';

import { ProjectExplorerProvider } from './providers/ProjectExplorerProvider';
import { ContractManagerProvider } from './providers/ContractManagerProvider';
import { AccountManagerProvider } from './providers/AccountManagerProvider';

import { registerAccountCommands } from './commands/accountCommands';
import { registerContractCommands } from './commands/contractCommands';
import { registerProjectCommands } from './commands/projectCommands';

import { NearTaskProvider } from './tasks/NearTaskProvider';
import { fetch } from './utils/fetch';

const execAsync = promisify(exec);

export async function activate(context: vscode.ExtensionContext) {
    console.log('Near Smart Contracts extension activated');

    // Init providers
    const projectExplorerProvider = new ProjectExplorerProvider(context.extensionUri);
    const contractManagerProvider = new ContractManagerProvider(context.extensionUri);
    const accountManagerProvider = new AccountManagerProvider();

    // Register providers
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('near-studio.projectExplorer', projectExplorerProvider),
        vscode.window.registerWebviewViewProvider('near-studio.contractManager', contractManagerProvider),
        vscode.window.registerTreeDataProvider('near-studio.accountManager', accountManagerProvider),
        contractManagerProvider,
        accountManagerProvider
    );

    // Register commands modularly
    context.subscriptions.push(
        ...registerAccountCommands(accountManagerProvider),
        ...registerContractCommands(),
        ...registerProjectCommands(accountManagerProvider),
    );

    // Register task provider
    context.subscriptions.push(vscode.tasks.registerTaskProvider('near', new NearTaskProvider()));

    // Check projects and tooling
    await checkForNearProject();
    await validateToolchains();

    // Polyfill fetch if needed
    if (!(global as any).fetch) {
        (global as any).fetch = fetch;
    }
}

export function deactivate() {
    // Cleanup if needed
}

async function checkForNearProject() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    const projectType = await detectProjectType(workspaceFolder.uri.fsPath);
    if (projectType) {
        vscode.window.showInformationMessage(
            `Near ${projectType} project detected! Use Near commands via Command Palette.`,
            'Show Commands'
        ).then(selection => {
            if (selection === 'Show Commands') { 
                vscode.commands.executeCommand('workbench.action.showCommands', 'Near:');
            }
        });
    }
}

async function detectProjectType(workspacePath: string): Promise<string | null> {
    const fs = await import('fs');
    const path = await import('path');

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
        } catch { }
    }
    return null;
}

async function validateToolchains() {
    const config = vscode.workspace.getConfiguration('nearExtension');
    if (!config.get<boolean>('autoInstallDeps', true)) return;

    try { await execAsync('near --version'); } catch {
        const btn = await vscode.window.showWarningMessage(
            'Near CLI not found. Install it for full functionality.',
            'Install Near CLI', 'Ignore'
        );
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
            } catch {
                const btn = await vscode.window.showWarningMessage(
                    'Rust toolchain not found. Install it for Rust contract development.',
                    'Install Rust', 'Ignore'
                );
                if (btn === 'Install Rust') {
                    vscode.env.openExternal(vscode.Uri.parse('https://rustup.rs/'));
                }
            }
        }
    }
}
