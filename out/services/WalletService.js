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
exports.WalletService = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const nearCliUtils_1 = require("../utils/nearCliUtils");
const CredentialsService_1 = require("./CredentialsService");
class WalletService {
    constructor() {
        this.credentialsService = new CredentialsService_1.CredentialsService();
    }
    async createWallet(network, accounts, refreshCallback) {
        try {
            const accountId = await this.getAccountIdInput(network);
            if (!accountId)
                return;
            if (network === 'testnet') {
                await this.handleTestnetCreation(accountId, network, refreshCallback);
            }
            else if (network === 'mainnet') {
                await this.handleMainnetCreation();
            }
            else {
                await this.createSandboxAccount(accountId, network, refreshCallback);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to create wallet: ${error}`);
            console.error('Error creating wallet:', error);
        }
    }
    async getAccountIdInput(network) {
        return await vscode.window.showInputBox({
            prompt: `Enter account ID for ${network}`,
            placeHolder: network === 'testnet' ? 'myaccount.testnet' :
                network === 'mainnet' ? 'myaccount.near' : 'myaccount.test.near',
            validateInput: (value) => {
                if (!value)
                    return 'Account ID is required';
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
    async handleTestnetCreation(accountId, network, refreshCallback) {
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
        if (!method)
            return;
        if (method.label === 'Use NEAR Wallet (Recommended)') {
            await this.createAccountViaWallet(accountId, network);
        }
        else {
            await this.createAccountManually(accountId, network, refreshCallback);
        }
    }
    async handleMainnetCreation() {
        vscode.window.showInformationMessage('Mainnet accounts must be created through NEAR Wallet.', 'Open NEAR Wallet').then(selection => {
            if (selection === 'Open NEAR Wallet') {
                vscode.env.openExternal(vscode.Uri.parse('https://wallet.near.org'));
            }
        });
    }
    async createAccountViaWallet(accountId, network) {
        const walletUrl = network === 'testnet'
            ? `https://wallet.testnet.near.org/create/${accountId}`
            : `https://wallet.near.org/create/${accountId}`;
        const proceed = await vscode.window.showInformationMessage(`This will open NEAR Wallet to create ${accountId}. After creating the account, return here to import it.`, 'Open Wallet', 'Cancel');
        if (proceed === 'Open Wallet') {
            await vscode.env.openExternal(vscode.Uri.parse(walletUrl));
            setTimeout(() => {
                vscode.window.showInformationMessage('After creating your account in NEAR Wallet, would you like to import it now?', 'Import Account').then(selection => {
                    if (selection === 'Import Account') {
                        this.importWallet(network, new Map(), () => { });
                    }
                });
            }, 3000);
        }
    }
    async createAccountManually(accountId, network, refreshCallback) {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Creating ${network} wallet...`,
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 25, message: 'Generating keys...' });
            const keyPair = await nearCliUtils_1.NearCliUtils.generateKeysWithNearCliRs();
            progress.report({ increment: 50, message: 'Saving credentials...' });
            await this.credentialsService.saveNearCliCredentials(accountId, network, keyPair);
            progress.report({ increment: 75, message: 'Account setup complete' });
            const newAccount = {
                id: accountId,
                network: network,
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
    async showFundingInstructions(accountId) {
        const choice = await vscode.window.showInformationMessage(`✅ Keys generated for ${accountId}!\n\nTo activate your account, you need to fund it. You can:\n1. Use the NEAR testnet faucet\n2. Ask someone to send you NEAR\n3. Use a linkdrop`, 'Open Faucet', 'Copy Public Key', 'Switch to Account');
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
    async createSandboxAccount(accountId, network, refreshCallback) {
        try {
            const keyPair = await nearCliUtils_1.NearCliUtils.generateKeysWithNearCliRs();
            await this.credentialsService.saveNearCliCredentials(accountId, network, keyPair);
            const newAccount = {
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
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to create sandbox account: ${error}`);
        }
    }
    async importWallet(network, accounts, refreshCallback) {
        try {
            const accountId = await vscode.window.showInputBox({
                prompt: `Enter existing account ID for ${network}`,
                placeHolder: network === 'testnet' ? 'existing.testnet' :
                    network === 'mainnet' ? 'existing.near' : 'existing.test.near'
            });
            if (!accountId)
                return;
            const { privateKey, publicKey } = await this.getImportCredentials(accountId, network);
            if (!privateKey || !publicKey)
                return;
            // Verify account exists
            const accountExists = await nearCliUtils_1.NearCliUtils.verifyAccountExists(accountId, network);
            if (!accountExists) {
                vscode.window.showErrorMessage(`Account ${accountId} does not exist on ${network}. Please create it first or check the account ID.`);
                return;
            }
            // Save credentials
            await this.credentialsService.saveNearCliCredentials(accountId, network, { publicKey, privateKey });
            const importedAccount = {
                id: accountId,
                network: network,
                publicKey: publicKey,
                privateKey: privateKey,
                balance: 'Loading...',
                isActive: true
            };
            await this.credentialsService.saveAccount(importedAccount);
            vscode.window.showInformationMessage(`✅ Account imported: ${accountId}`, 'Switch to Account');
            refreshCallback();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to import wallet: ${error}`);
            console.error('Error importing wallet:', error);
        }
    }
    async getImportCredentials(accountId, network) {
        const importMethod = await vscode.window.showQuickPick([
            { label: 'Private Key', description: 'Import using private key (ed25519:...)' },
            { label: 'Seed Phrase', description: 'Import using 12-word seed phrase' },
            { label: 'NEAR CLI Credentials', description: 'Import from existing NEAR CLI credentials' },
            { label: 'JSON File', description: 'Import from credentials JSON file' }
        ], { placeHolder: 'Select import method' });
        if (!importMethod)
            return { privateKey: '', publicKey: '' };
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
    async importFromPrivateKey(accountId, network) {
        const inputPrivateKey = await vscode.window.showInputBox({
            prompt: 'Enter private key (should start with "ed25519:")',
            password: true,
            validateInput: (value) => {
                if (!value)
                    return 'Private key is required';
                if (!value.startsWith('ed25519:'))
                    return 'Private key must start with "ed25519:"';
                return null;
            }
        });
        if (!inputPrivateKey)
            return { privateKey: '', publicKey: '' };
        try {
            const publicKey = await nearCliUtils_1.NearCliUtils.derivePublicKeyFromPrivate(inputPrivateKey, accountId, network);
            return { privateKey: inputPrivateKey, publicKey };
        }
        catch (error) {
            const publicKey = inputPrivateKey.replace('ed25519:', '').substring(0, 44);
            return { privateKey: inputPrivateKey, publicKey: 'ed25519:' + publicKey };
        }
    }
    async importFromNearCli(accountId, network) {
        try {
            const credentialsPath = this.credentialsService.getNearCliCredentialsPath(accountId, network);
            return this.credentialsService.loadCredentialsFromFile(credentialsPath);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to import from NEAR CLI: ${error}`);
            return { privateKey: '', publicKey: '' };
        }
    }
    async importFromJsonFile() {
        const fileUri = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: { 'JSON files': ['json'] },
            title: 'Select NEAR credentials JSON file'
        });
        if (!fileUri || fileUri.length === 0)
            return { privateKey: '', publicKey: '' };
        try {
            const fileContent = fs.readFileSync(fileUri[0].fsPath, 'utf8');
            const credentials = JSON.parse(fileContent);
            return {
                privateKey: credentials.private_key,
                publicKey: credentials.public_key
            };
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to read credentials file: ${error}`);
            return { privateKey: '', publicKey: '' };
        }
    }
}
exports.WalletService = WalletService;
//# sourceMappingURL=WalletService.js.map