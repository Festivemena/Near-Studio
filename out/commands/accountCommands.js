"use strict";
// src/commands/accountCommands.ts
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
exports.registerAccountCommands = void 0;
const vscode = __importStar(require("vscode"));
const util_1 = require("util");
const exec = (0, util_1.promisify)(require('child_process').exec);
function registerAccountCommands(context, accountManagerProvider) {
    context.subscriptions.push(
    // Create wallet command with enhanced CLI faucet support
    vscode.commands.registerCommand('near-studio.createWallet', async (network) => {
        if (!network) {
            const networkOptions = [
                { label: 'Testnet', description: 'Create testnet account (free test tokens)', value: 'testnet' },
                { label: 'Mainnet', description: 'Create mainnet account (real NEAR tokens)', value: 'mainnet' },
                { label: 'Sandbox', description: 'Create local sandbox account', value: 'sandbox' }
            ];
            const selected = await vscode.window.showQuickPick(networkOptions, {
                placeHolder: 'Select network for new wallet'
            });
            if (!selected)
                return;
            network = selected.value;
        }
        await accountManagerProvider.createWallet(network);
    }), 
    // Fund testnet account using CLI faucet only
    vscode.commands.registerCommand('near-studio.fundTestnetAccount', async (accountItem) => {
        if (accountItem && accountItem.contextValue === 'account' && accountItem.network === 'testnet') {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Funding ${accountItem.label}...`,
                cancellable: false
            }, async () => {
                try {
                    // Use near create-account with --useFaucet
                    const command = `near create-account ${accountItem.label} --useFaucet`;
                    const { stdout, stderr } = await exec(command);
                    if (stderr && !stderr.includes('WARNING') && !stderr.includes('already exists')) {
                        throw new Error(stderr);
                    }
                    if (stderr.includes('already exists')) {
                        vscode.window.showInformationMessage(`Account ${accountItem.label} already exists and is funded!`);
                    }
                    else {
                        vscode.window.showInformationMessage(`✅ ${accountItem.label} created and funded with test tokens!`);
                    }
                    accountManagerProvider.refresh();
                }
                catch (error) {
                    const errorMessage = error.message || error.toString();
                    if (errorMessage.includes('near-cli-rs') || errorMessage.includes('command not found')) {
                        vscode.window.showErrorMessage('NEAR CLI is not installed. Install with: cargo install near-cli-rs', 'Installation Guide').then(selection => {
                            if (selection === 'Installation Guide') {
                                vscode.env.openExternal(vscode.Uri.parse('https://github.com/near/near-cli-rs#installation'));
                            }
                        });
                    }
                    else {
                        vscode.window.showErrorMessage(`Failed to fund account: ${errorMessage}`);
                    }
                }
            });
        }
    }), 
    // Quick create account with CLI faucet command
    vscode.commands.registerCommand('near-studio.quickCreateTestnetAccount', async () => {
        const accountId = await vscode.window.showInputBox({
            prompt: 'Enter account ID for testnet (will auto-append .testnet if needed)',
            placeHolder: 'myaccount',
            validateInput: (value) => {
                if (!value)
                    return 'Account ID is required';
                if (value.includes('.') && !value.endsWith('.testnet')) {
                    return 'Testnet accounts must end with .testnet';
                }
                return null;
            }
        });
        if (!accountId)
            return;
        const fullAccountId = accountId.includes('.') ? accountId : `${accountId}.testnet`;
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Creating ${fullAccountId}...`,
            cancellable: false
        }, async (progress) => {
            try {
                progress.report({ increment: 30, message: 'Executing NEAR CLI command...' });
                const command = `near create-account ${fullAccountId} --useFaucet`;
                const { stdout, stderr } = await exec(command);
                progress.report({ increment: 70, message: 'Finalizing account...' });
                if (stderr && !stderr.includes('WARNING') && !stderr.includes('already exists')) {
                    throw new Error(stderr);
                }
                progress.report({ increment: 100, message: 'Account created!' });
                if (stderr && stderr.includes('already exists')) {
                    vscode.window.showWarningMessage(`Account ${fullAccountId} already exists!`);
                }
                else {
                    vscode.window.showInformationMessage(`✅ Account ${fullAccountId} created successfully with test tokens!`, 'Refresh Accounts').then(selection => {
                        if (selection === 'Refresh Accounts') {
                            accountManagerProvider.refresh();
                        }
                    });
                }
            }
            catch (error) {
                const errorMessage = error.message || error.toString();
                if (errorMessage.includes('near-cli-rs') || errorMessage.includes('command not found')) {
                    vscode.window.showErrorMessage('NEAR CLI is not installed. Install with: cargo install near-cli-rs', 'Installation Guide').then(selection => {
                        if (selection === 'Installation Guide') {
                            vscode.env.openExternal(vscode.Uri.parse('https://github.com/near/near-cli-rs#installation'));
                        }
                    });
                }
                else {
                    vscode.window.showErrorMessage(`Failed to create account: ${errorMessage}`);
                }
            }
        });
    }), vscode.commands.registerCommand('near-studio.importWallet', async (network) => {
        if (!network) {
            const networkOptions = [
                { label: 'Testnet', description: 'Import testnet account', value: 'testnet' },
                { label: 'Mainnet', description: 'Import mainnet account', value: 'mainnet' },
                { label: 'Sandbox', description: 'Import sandbox account', value: 'sandbox' }
            ];
            const selected = await vscode.window.showQuickPick(networkOptions, {
                placeHolder: 'Select network for account to import'
            });
            if (!selected)
                return;
            network = selected.value;
        }
        await accountManagerProvider.importWallet(network);
    }), vscode.commands.registerCommand('near-studio.switchAccount', async (accountItem) => {
        if (accountItem && accountItem.contextValue === 'account') {
            await accountManagerProvider.switchToAccount(accountItem.label, accountItem.network);
        }
        else {
            await showAccountSwitcher(accountManagerProvider);
        }
    }), vscode.commands.registerCommand('near-studio.disconnectAccount', async (accountItem) => {
        if (accountItem && accountItem.contextValue === 'account') {
            await accountManagerProvider.disconnectAccount(accountItem.label, accountItem.network);
        }
    }), vscode.commands.registerCommand('near-studio.copyAccountKey', async (accountItem) => {
        if (accountItem && accountItem.contextValue === 'account') {
            await accountManagerProvider.copyAccountKey(accountItem.label, accountItem.network);
        }
    }), vscode.commands.registerCommand('near-studio.switchNetwork', async (accountItem) => {
        if (accountItem && accountItem.contextValue === 'account') {
            const networkOptions = [
                { label: 'Testnet', value: 'testnet' },
                { label: 'Mainnet', value: 'mainnet' },
                { label: 'Sandbox', value: 'sandbox' }
            ];
            const selected = await vscode.window.showQuickPick(networkOptions, {
                placeHolder: `Switch ${accountItem.label} to different network`
            });
            if (selected) {
                await accountManagerProvider.switchToAccount(accountItem.label, selected.value);
            }
        }
    }), vscode.commands.registerCommand('near-studio.fundTestnetAccount', async (accountItem) => {
        if (accountItem && accountItem.contextValue === 'account' && accountItem.network === 'testnet') {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Funding ${accountItem.label}...`,
                cancellable: false
            }, async () => {
                try {
                    // Try helper.testnet.near.org faucet API
                    const fetch = global.fetch || require('node-fetch');
                    const response = await fetch('https://helper.testnet.near.org/account', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            newAccountId: accountItem.label,
                            newAccountPublicKey: 'ed25519:placeholder' // TODO: replace with real key if available
                        }),
                    });
                    if (response.ok) {
                        vscode.window.showInformationMessage(`✅ ${accountItem.label} funded with test tokens!`);
                        accountManagerProvider.refresh();
                        return;
                    }
                    throw new Error('Funding request failed');
                }
                catch (error) {
                    // Fallback to near-cli command if faucet fails
                    try {
                        const exec = (0, util_1.promisify)(require('child_process').exec);
                        await exec(`near send testnet ${accountItem.label} 10 --networkId testnet`);
                        vscode.window.showInformationMessage(`✅ ${accountItem.label} funded with test tokens!`);
                        accountManagerProvider.refresh();
                    }
                    catch (cliError) {
                        vscode.window.showErrorMessage(`Failed to fund account: ${error}`);
                    }
                }
            });
        }
    }), vscode.commands.registerCommand('near-studio.viewAccountOnExplorer', async (accountItem) => {
        if (accountItem && accountItem.contextValue === 'account') {
            const explorerUrl = accountItem.network === 'testnet'
                ? `https://explorer.testnet.near.org/accounts/${accountItem.label}`
                : accountItem.network === 'mainnet'
                    ? `https://explorer.near.org/accounts/${accountItem.label}`
                    : `http://localhost:3030/accounts/${accountItem.label}`;
            vscode.env.openExternal(vscode.Uri.parse(explorerUrl));
        }
    }), vscode.commands.registerCommand('near-studio.refreshAccountBalance', async (accountItem) => {
        if (accountItem && accountItem.contextValue === 'account') {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Refreshing balance for ${accountItem.label}...`,
                cancellable: false
            }, async () => {
                accountManagerProvider.refresh();
            });
        }
    }), vscode.commands.registerCommand('near-studio.exportAccounts', async () => {
        const config = vscode.workspace.getConfiguration('near-studio');
        const accounts = config.get('accounts') || {};
        if (Object.keys(accounts).length === 0) {
            vscode.window.showInformationMessage('No accounts to export');
            return;
        }
        const exportData = Object.entries(accounts).reduce((acc, [id, account]) => {
            acc[id] = {
                id: account.id,
                network: account.network,
                publicKey: account.publicKey
            };
            return acc;
        }, {});
        const exportString = JSON.stringify(exportData, null, 2);
        await vscode.env.clipboard.writeText(exportString);
        vscode.window.showInformationMessage('Account list copied to clipboard (private keys excluded)');
    }), vscode.commands.registerCommand('near-studio.clearAllAccounts', async () => {
        const confirm = await vscode.window.showWarningMessage('This will remove ALL accounts from VS Code. Are you sure?', { modal: true }, 'Clear All Accounts', 'Cancel');
        if (confirm === 'Clear All Accounts') {
            const config = vscode.workspace.getConfiguration('near-studio');
            await config.update('accounts', {}, vscode.ConfigurationTarget.Global);
            await config.update('accountId', '', vscode.ConfigurationTarget.Workspace);
            accountManagerProvider.refresh();
            vscode.window.showInformationMessage('All accounts cleared');
        }
    }));
}
exports.registerAccountCommands = registerAccountCommands;
// Optionally implement an account switcher helper UI
async function showAccountSwitcher(accountManagerProvider) {
    const config = vscode.workspace.getConfiguration('near-studio');
    const accounts = config.get('accounts') || {};
    const accountOptions = Object.entries(accounts).map(([id, account]) => ({
        label: `${id} (${account.network})`,
        description: account.balance || 'Loading...',
        detail: account.isActive ? '✅ Currently active' : '',
        accountId: id,
        network: account.network
    }));
    if (accountOptions.length === 0) {
        const action = await vscode.window.showInformationMessage('No accounts configured. Would you like to add one?', 'Create Wallet', 'Import Wallet');
        if (action === 'Create Wallet') {
            vscode.commands.executeCommand('near-studio.createWallet');
        }
        else if (action === 'Import Wallet') {
            vscode.commands.executeCommand('near-studio.importWallet');
        }
        return;
    }
    const selected = await vscode.window.showQuickPick(accountOptions, {
        placeHolder: 'Select account to switch to'
    });
    if (selected) {
        await accountManagerProvider.switchToAccount(selected.accountId, selected.network);
    }
}
//# sourceMappingURL=accountCommands.js.map