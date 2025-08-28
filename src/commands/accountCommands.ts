// src/commands/accountCommands.ts

import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { AccountManagerProvider } from '../providers/AccountManagerProvider';

const execAsync = promisify(exec);

export function registerAccountCommands(accountManagerProvider: AccountManagerProvider): vscode.Disposable[] {
    return [
        vscode.commands.registerCommand('near-studio.refreshAccounts', () => {
            accountManagerProvider.refresh();
        }),

        vscode.commands.registerCommand('near-studio.addAccount', async () => {
            const options = [
                { label: '🚀 Create New Wallet', description: 'Create a brand new NEAR wallet' },
                { label: '📥 Import Existing Wallet', description: 'Import an existing NEAR account' }
            ];

            const selected = await vscode.window.showQuickPick(options, {
                placeHolder: 'Choose how to add an account'
            });

            if (selected?.label.includes('Create')) {
                vscode.commands.executeCommand('near-studio.createWallet');
            } else if (selected?.label.includes('Import')) {
                vscode.commands.executeCommand('near-studio.importWallet');
            }
        }),

        vscode.commands.registerCommand('near-studio.createWallet', async (network?: string) => {
            if (!network) {
                const networkOptions = [
                    { label: 'Testnet', description: 'Create testnet account (free test tokens)', value: 'testnet' },
                    { label: 'Mainnet', description: 'Create mainnet account (real NEAR tokens)', value: 'mainnet' },
                    { label: 'Sandbox', description: 'Create local sandbox account', value: 'sandbox' }
                ];

                const selected = await vscode.window.showQuickPick(networkOptions, {
                    placeHolder: 'Select network for new wallet'
                });

                if (!selected) return;
                network = selected.value;
            }
            await accountManagerProvider.createWallet(network as any);
        }),

        vscode.commands.registerCommand('near-studio.importWallet', async (network?: string) => {
            if (!network) {
                const networkOptions = [
                    { label: 'Testnet', description: 'Import testnet account', value: 'testnet' },
                    { label: 'Mainnet', description: 'Import mainnet account', value: 'mainnet' },
                    { label: 'Sandbox', description: 'Import sandbox account', value: 'sandbox' }
                ];

                const selected = await vscode.window.showQuickPick(networkOptions, {
                    placeHolder: 'Select network for account to import'
                });

                if (!selected) return;
                network = selected.value;
            }
            await accountManagerProvider.importWallet(network as any);
        }),

        vscode.commands.registerCommand('near-studio.switchAccount', async (accountItem?) => {
            if (accountItem && accountItem.contextValue === 'account') {
                await accountManagerProvider.switchToAccount(accountItem.label, accountItem.network);
            } else {
                await showAccountSwitcher(accountManagerProvider);
            }
        }),

        vscode.commands.registerCommand('near-studio.disconnectAccount', async (accountItem) => {
            if (accountItem && accountItem.contextValue === 'account') {
                await accountManagerProvider.disconnectAccount(accountItem.label, accountItem.network);
            }
        }),

        vscode.commands.registerCommand('near-studio.copyAccountKey', async (accountItem) => {
            if (accountItem && accountItem.contextValue === 'account') {
                await accountManagerProvider.copyAccountKey(accountItem.label, accountItem.network);
            }
        }),

        vscode.commands.registerCommand('near-studio.switchNetwork', async (accountItem) => {
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
                    await accountManagerProvider.switchToAccount(accountItem.label, selected.value as any);
                }
            }
        }),

        vscode.commands.registerCommand('near-studio.fundTestnetAccount', async (accountItem) => {
            if (accountItem && accountItem.contextValue === 'account' && accountItem.network === 'testnet') {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Funding ${accountItem.label}...`,
                    cancellable: false
                }, async () => {
                    try {
                        // Try helper.testnet.near.org faucet API
                        const fetch = (global as any).fetch || require('node-fetch');
                        const response = await fetch('https://helper.testnet.near.org/account', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
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
                    } catch (error) {
                        // Fallback to near-cli command if faucet fails
                        try {
                            const exec = promisify(require('child_process').exec);
                            await exec(`near send testnet ${accountItem.label} 10 --networkId testnet`);
                            vscode.window.showInformationMessage(`✅ ${accountItem.label} funded with test tokens!`);
                            accountManagerProvider.refresh();
                        } catch (cliError) {
                            vscode.window.showErrorMessage(`Failed to fund account: ${error}`);
                        }
                    }
                });
            }
        }),

        vscode.commands.registerCommand('near-studio.viewAccountOnExplorer', async (accountItem) => {
            if (accountItem && accountItem.contextValue === 'account') {
                const explorerUrl = accountItem.network === 'testnet' 
                    ? `https://explorer.testnet.near.org/accounts/${accountItem.label}`
                    : accountItem.network === 'mainnet'
                    ? `https://explorer.near.org/accounts/${accountItem.label}`
                    : `http://localhost:3030/accounts/${accountItem.label}`;
                vscode.env.openExternal(vscode.Uri.parse(explorerUrl));
            }
        }),

        vscode.commands.registerCommand('near-studio.refreshAccountBalance', async (accountItem) => {
            if (accountItem && accountItem.contextValue === 'account') {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Refreshing balance for ${accountItem.label}...`,
                    cancellable: false
                }, async () => {
                    accountManagerProvider.refresh();
                });
            }
        }),

        vscode.commands.registerCommand('near-studio.exportAccounts', async () => {
            const config = vscode.workspace.getConfiguration('nearExtension');
            const accounts = config.get<any>('accounts') || {};

            if (Object.keys(accounts).length === 0) {
                vscode.window.showInformationMessage('No accounts to export');
                return;
            }

            const exportData = Object.entries(accounts).reduce((acc, [id, account]: [string, any]) => {
                acc[id] = {
                    id: account.id,
                    network: account.network,
                    publicKey: account.publicKey
                };
                return acc;
            }, {} as any);

            const exportString = JSON.stringify(exportData, null, 2);

            await vscode.env.clipboard.writeText(exportString);
            vscode.window.showInformationMessage('Account list copied to clipboard (private keys excluded)');
        }),

        vscode.commands.registerCommand('near-studio.clearAllAccounts', async () => {
            const confirm = await vscode.window.showWarningMessage(
                'This will remove ALL accounts from VS Code. Are you sure?',
                { modal: true },
                'Clear All Accounts',
                'Cancel'
            );

            if (confirm === 'Clear All Accounts') {
                const config = vscode.workspace.getConfiguration('nearExtension');
                await config.update('accounts', {}, vscode.ConfigurationTarget.Global);
                await config.update('accountId', '', vscode.ConfigurationTarget.Workspace);

                accountManagerProvider.refresh();
                vscode.window.showInformationMessage('All accounts cleared');
            }
        }),
    ];
}

// Optionally implement an account switcher helper UI
async function showAccountSwitcher(accountManagerProvider: AccountManagerProvider) {
    const config = vscode.workspace.getConfiguration('nearExtension');
    const accounts = config.get<any>('accounts') || {};

    const accountOptions = Object.entries(accounts).map(([id, account]: [string, any]) => ({
        label: `${id} (${account.network})`,
        description: account.balance || 'Loading...',
        detail: account.isActive ? '✅ Currently active' : '',
        accountId: id,
        network: account.network
    }));

    if (accountOptions.length === 0) {
        const action = await vscode.window.showInformationMessage(
            'No accounts configured. Would you like to add one?',
            'Create Wallet',
            'Import Wallet'
        );
        if (action === 'Create Wallet') {
            vscode.commands.executeCommand('near-studio.createWallet');
        } else if (action === 'Import Wallet') {
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
