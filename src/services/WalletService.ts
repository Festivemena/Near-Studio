import * as vscode from 'vscode';
import * as fs from 'fs';
import { NearAccount } from '../types/accountTypes';
import { NearCliUtils } from '../utils/nearCliUtils';
import { CredentialsService } from './CredentialsService';

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
        const method = await vscode.window.showQuickPick([
            { 
                label: 'Use NEAR Wallet (Recommended)', 
                description: 'Create account through web wallet',
                detail: 'Opens wallet.testnet.near.org to create account'
            },
            { 
                label: 'Generate Keys Manually', 
                description: 'Generate keys and fund manually',
                detail: 'Creates keys locally, you fund the account'
            }
        ], { 
            placeHolder: 'Choose account creation method' 
        });

        if (!method) return;

        if (method.label === 'Use NEAR Wallet (Recommended)') {
            await this.createAccountViaWallet(accountId, network);
        } else {
            await this.createAccountManually(accountId, network, refreshCallback);
        }
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

    private async createAccountViaWallet(accountId: string, network: string): Promise<void> {
        const walletUrl = network === 'testnet' 
            ? `https://wallet.testnet.near.org/create/${accountId}`
            : `https://wallet.near.org/create/${accountId}`;
        
        const proceed = await vscode.window.showInformationMessage(
            `This will open NEAR Wallet to create ${accountId}. After creating the account, return here to import it.`,
            'Open Wallet',
            'Cancel'
        );

        if (proceed === 'Open Wallet') {
            await vscode.env.openExternal(vscode.Uri.parse(walletUrl));
            
            setTimeout(() => {
                vscode.window.showInformationMessage(
                    'After creating your account in NEAR Wallet, would you like to import it now?',
                    'Import Account'
                ).then(selection => {
                    if (selection === 'Import Account') {
                        this.importWallet(network as any, new Map(), () => {});
                    }
                });
            }, 3000);
        }
    }

    private async createAccountManually(accountId: string, network: string, refreshCallback: () => void): Promise<void> {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Creating ${network} wallet...`,
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 25, message: 'Generating keys...' });

            const keyPair = await NearCliUtils.generateKeysWithNearCliRs();
            
            progress.report({ increment: 50, message: 'Saving credentials...' });
            
            await this.credentialsService.saveNearCliCredentials(accountId, network, keyPair);
            
            progress.report({ increment: 75, message: 'Account setup complete' });

            const newAccount: NearAccount = {
                id: accountId,
                network: network as any,
                publicKey: keyPair.publicKey,
                privateKey: keyPair.privateKey,
                balance: '0 NEAR (Not funded)',
                isActive: true
            };

            await this.credentialsService.saveAccount(newAccount);
            progress.report({ increment: 100, message: 'Ready to fund!' });
        });

        await this.showFundingInstructions(accountId);
        refreshCallback();
    }

    private async showFundingInstructions(accountId: string): Promise<void> {
        const choice = await vscode.window.showInformationMessage(
            `✅ Keys generated for ${accountId}!\n\nTo activate your account, you need to fund it. You can:\n1. Use the NEAR testnet faucet\n2. Ask someone to send you NEAR\n3. Use a linkdrop`,
            'Open Faucet',
            'Copy Public Key',
            'Switch to Account'
        );

        switch (choice) {
            case 'Open Faucet':
                await vscode.env.openExternal(vscode.Uri.parse('https://near-faucet.io/'));
                break;
            case 'Copy Public Key':
                // Implementation would need access to accounts map
                break;
            case 'Switch to Account':
                // Implementation would need access to switch method
                break;
        }
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
