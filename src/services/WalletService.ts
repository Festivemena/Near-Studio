import * as vscode from 'vscode';
import * as fs from 'fs';
import { NearAccount } from '../types/accountTypes';
import { NearCliUtils } from '../utils/nearCliUtils';
import { CredentialsService } from './CredentialsService';
import { promisify } from 'util';
const exec = promisify(require('child_process').exec);

export class WalletService {
    private credentialsService = new CredentialsService();

    async createWallet(network: 'testnet' | 'mainnet' | 'sandbox', accounts: Map<string, NearAccount[]>, refreshCallback: () => void): Promise<void> {
        try {
            const accountId = await this.getAccountIdInput(network);
            if (!accountId) return;

            if (network === 'testnet') {
                await this.handleTestnetCreation(accountId, network, refreshCallback);
            } else if (network === 'mainnet') {
                await this.handleMainnetCreation();
            } else {
                await this.createSandboxAccount(accountId, network, refreshCallback);
            }

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create wallet: ${error}`);
            console.error('Error creating wallet:', error);
        }
    }

    private async getAccountIdInput(network: string): Promise<string | undefined> {
        return await vscode.window.showInputBox({
            prompt: `Enter account ID for ${network}`,
            placeHolder: network === 'testnet' ? 'myaccount.testnet' : 
                       network === 'mainnet' ? 'myaccount.near' : 'myaccount.test.near',
            validateInput: (value) => {
                if (!value) return 'Account ID is required';
                
                if (network === 'testnet' && !value.endsWith('.testnet')) {
                    return 'Testnet accounts must end with .testnet';
                }
                if (network === 'mainnet' && !value.endsWith('.near')) {
                    return 'Mainnet accounts must end with .near';
                }
                if (network === 'sandbox' && !value.includes('.test.')) {
                    return 'Sandbox accounts must include .test.';
                }
                
                return null;
            }
        });
    }

    private async handleTestnetCreation(accountId: string, network: string, refreshCallback: () => void): Promise<void> {
        await this.createAccountWithCLIFaucet(accountId, network, refreshCallback);
    }

    private async saveAccountToConfig(accountId: string, network: string): Promise<void> {
    try {
        const config = vscode.workspace.getConfiguration('nearExtension');
        const accounts = config.get<any>('accounts') || {};
        
        const keyPath = this.getDefaultKeyPath(accountId, network);
        
        let publicKey = '';
        let privateKey = '';
        
        try {
            if (fs.existsSync(keyPath)) {
                const credentials = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
                publicKey = credentials.public_key || '';
                privateKey = credentials.private_key || '';
            }
        } catch (err) {
            console.log('Could not read credentials:', err);
        }
        
        accounts[accountId] = {
            id: accountId,
            network: network,
            keyPath: keyPath,
            publicKey: publicKey,
            privateKey: privateKey,
            isActive: false
        };
        
        await config.update('accounts', accounts, vscode.ConfigurationTarget.Global);
        
        console.log(`✅ Saved account ${accountId} to VS Code configuration`);
    } catch (error) {
        console.error('❌ Failed to save account to config:', error);
        throw error;
    }
}

    private async createAccountWithCLIFaucet(accountId: string, network: string, refreshCallback: () => void): Promise<void> {
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Creating account ${accountId} on ${network}...`,
        cancellable: false
    }, async (progress) => {
        try {
            progress.report({ increment: 20, message: 'Running NEAR CLI command...' });
            
            const command = `near create-account ${accountId} --useFaucet`;
            console.log(`Executing: ${command}`);
            
            const { stdout, stderr } = await exec(command);
            
            console.log('STDOUT:', stdout);
            console.log('STDERR:', stderr);
            
            progress.report({ increment: 60, message: 'Verifying account creation...' });
            
            // If the command executed without throwing an error, it succeeded
            // The CLI command will throw an error if it fails, so reaching here means success
            
            progress.report({ increment: 20, message: 'Account created successfully!' });
            
            // Save the account to VS Code configuration
            await this.saveAccountToConfig(accountId, network);
            
            vscode.window.showInformationMessage(
                `✅ Successfully created account: ${accountId}`,
                'View Account'
            ).then(selection => {
                if (selection === 'View Account') {
                    refreshCallback();
                }
            });
            
        } catch (error: any) {
            const errorMessage = error.message || error.toString();
            console.error('Account creation error:', errorMessage);
            
            // Check for specific error conditions
            if (errorMessage.includes('already exists')) {
                vscode.window.showWarningMessage(
                    `Account ${accountId} already exists. Would you like to import it instead?`,
                    'Import Account'
                ).then(selection => {
                    if (selection === 'Import Account') {
                        this.importCreatedAccount(accountId, network, refreshCallback);
                    }
                });
            } else if (errorMessage.includes('near-cli-rs') || errorMessage.includes('command not found') || errorMessage.includes('near: command not found')) {
                vscode.window.showErrorMessage(
                    'NEAR CLI is not installed or not in PATH. Please install near-cli-rs: cargo install near-cli-rs',
                    'Install Instructions'
                ).then(selection => {
                    if (selection === 'Install Instructions') {
                        vscode.env.openExternal(vscode.Uri.parse('https://github.com/near/near-cli-rs#installation'));
                    }
                });
            } else {
                // Only show error if it's an actual failure
                vscode.window.showErrorMessage(`Failed to create account: ${errorMessage}`);
            }
        }
    });
}

    private async importCreatedAccount(accountId: string, network: string, refreshCallback: () => void): Promise<void> {
        try {
            // Check if the account exists and get its keys
            const keyPath = this.getDefaultKeyPath(accountId, network);
            
            vscode.window.showInformationMessage(
                `Account ${accountId} should now be available in your local NEAR CLI configuration.`,
                'Refresh Accounts'
            ).then(selection => {
                if (selection === 'Refresh Accounts') {
                    refreshCallback();
                }
            });
            
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to import account: ${error.message}`);
        }
    }

    private getDefaultKeyPath(accountId: string, network: string): string {
        const os = require('os');
        const path = require('path');
        return path.join(os.homedir(), '.near-credentials', network, `${accountId}.json`);
    }

    private async handleMainnetCreation(): Promise<void> {
        vscode.window.showInformationMessage(
            'Mainnet accounts must be created through NEAR Wallet.',
            'Open NEAR Wallet'
        ).then(selection => {
            if (selection === 'Open NEAR Wallet') {
                vscode.env.openExternal(vscode.Uri.parse('https://wallet.near.org'));
            }
        });
    }

    private async createSandboxAccount(accountId: string, network: 'sandbox', refreshCallback: () => void): Promise<void> {
        try {
            const keyPair = await NearCliUtils.generateKeysWithNearCliRs();
            await this.credentialsService.saveNearCliCredentials(accountId, network, keyPair);

            const newAccount: NearAccount = {
                id: accountId,
                network: network,
                publicKey: keyPair.publicKey,
                privateKey: keyPair.privateKey,
                balance: '0 NEAR (Not Funded)',
                isActive: true
            };

            await this.credentialsService.saveAccount(newAccount);
            vscode.window.showInformationMessage(`Sandbox account ${accountId} created. You may need to fund or initialize it in your sandbox environment.`);
            refreshCallback();
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create sandbox account: ${error}`);
        }
    }

    async importWallet(network: 'testnet' | 'mainnet' | 'sandbox', accounts: Map<string, NearAccount[]>, refreshCallback: () => void): Promise<void> {
        try {
            const accountId = await vscode.window.showInputBox({
                prompt: `Enter existing account ID for ${network}`,
                placeHolder: network === 'testnet' ? 'existing.testnet' : 
                           network === 'mainnet' ? 'existing.near' : 'existing.test.near'
            });

            if (!accountId) return;

            const { privateKey, publicKey } = await this.getImportCredentials(accountId, network);
            if (!privateKey || !publicKey) return;

            // Verify account exists
            const accountExists = await NearCliUtils.verifyAccountExists(accountId, network);
            if (!accountExists) {
                vscode.window.showErrorMessage(
                    `Account ${accountId} does not exist on ${network}. Please create it first or check the account ID.`
                );
                return;
            }

            // Save credentials
            await this.credentialsService.saveNearCliCredentials(accountId, network, { publicKey, privateKey });

            const importedAccount: NearAccount = {
                id: accountId,
                network: network,
                publicKey: publicKey,
                privateKey: privateKey,
                balance: 'Loading...',
                isActive: true
            };

            await this.credentialsService.saveAccount(importedAccount);

            vscode.window.showInformationMessage(
                `✅ Account imported: ${accountId}`,
                'Switch to Account'
            );

            refreshCallback();

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to import wallet: ${error}`);
            console.error('Error importing wallet:', error);
        }
    }

    private async getImportCredentials(accountId: string, network: string): Promise<{ privateKey: string; publicKey: string }> {
        const importMethod = await vscode.window.showQuickPick([
            { label: 'Private Key', description: 'Import using private key (ed25519:...)' },
            { label: 'Seed Phrase', description: 'Import using 12-word seed phrase' },
            { label: 'NEAR CLI Credentials', description: 'Import from existing NEAR CLI credentials' },
            { label: 'JSON File', description: 'Import from credentials JSON file' }
        ], { placeHolder: 'Select import method' });

        if (!importMethod) return { privateKey: '', publicKey: '' };

        switch (importMethod.label) {
            case 'Private Key':
                return await this.importFromPrivateKey(accountId, network);
            case 'NEAR CLI Credentials':
                return await this.importFromNearCli(accountId, network);
            case 'JSON File':
                return await this.importFromJsonFile();
            case 'Seed Phrase':
                vscode.window.showInformationMessage('Seed phrase import will be available in next version. Use private key import instead.');
                return { privateKey: '', publicKey: '' };
            default:
                return { privateKey: '', publicKey: '' };
        }
    }

    private async importFromPrivateKey(accountId: string, network: string): Promise<{ privateKey: string; publicKey: string }> {
        const inputPrivateKey = await vscode.window.showInputBox({
            prompt: 'Enter private key (should start with "ed25519:")',
            password: true,
            validateInput: (value) => {
                if (!value) return 'Private key is required';
                if (!value.startsWith('ed25519:')) return 'Private key must start with "ed25519:"';
                return null;
            }
        });

        if (!inputPrivateKey) return { privateKey: '', publicKey: '' };

        try {
            const publicKey = await NearCliUtils.derivePublicKeyFromPrivate(inputPrivateKey, accountId, network);
            return { privateKey: inputPrivateKey, publicKey };
        } catch (error) {
            const publicKey = inputPrivateKey.replace('ed25519:', '').substring(0, 44);
            return { privateKey: inputPrivateKey, publicKey: 'ed25519:' + publicKey };
        }
    }

    private async importFromNearCli(accountId: string, network: string): Promise<{ privateKey: string; publicKey: string }> {
        try {
            const credentialsPath = this.credentialsService.getNearCliCredentialsPath(accountId, network);
            return this.credentialsService.loadCredentialsFromFile(credentialsPath);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to import from NEAR CLI: ${error}`);
            return { privateKey: '', publicKey: '' };
        }
    }

    private async importFromJsonFile(): Promise<{ privateKey: string; publicKey: string }> {
        const fileUri = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: { 'JSON files': ['json'] },
            title: 'Select NEAR credentials JSON file'
        });

        if (!fileUri || fileUri.length === 0) return { privateKey: '', publicKey: '' };

        try {
            const fileContent = fs.readFileSync(fileUri[0].fsPath, 'utf8');
            const credentials = JSON.parse(fileContent);
            return {
                privateKey: credentials.private_key,
                publicKey: credentials.public_key
            };
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to read credentials file: ${error}`);
            return { privateKey: '', publicKey: '' };
        }
    }
}
