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
exports.WalletService = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const nearCliUtils_1 = require("../utils/nearCliUtils");
const CredentialsService_1 = require("./CredentialsService");
const util_1 = require("util");
const exec = (0, util_1.promisify)(require('child_process').exec);
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
                return null;
            }
        });
    }
    async handleTestnetCreation(accountId, network, refreshCallback) {
        await this.createAccountWithCLIFaucet(accountId, network, refreshCallback);
    }
    async saveAccountToConfig(accountId, network) {
        try {
            const config = vscode.workspace.getConfiguration('near-studio');
            const accounts = config.get('accounts') || {};
            const keyPath = this.getDefaultKeyPath(accountId, network);
            let publicKey = '';
            let privateKey = '';
            try {
                if (fs.existsSync(keyPath)) {
                    const credentials = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
                    publicKey = credentials.public_key || '';
                    privateKey = credentials.private_key || '';
                }
            }
            catch (err) {
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
        }
        catch (error) {
            console.error('❌ Failed to save account to config:', error);
            throw error;
        }
    }
    async createAccountWithCLIFaucet(accountId, network, refreshCallback) {
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
                vscode.window.showInformationMessage(`✅ Successfully created account: ${accountId}`, 'View Account').then(selection => {
                    if (selection === 'View Account') {
                        refreshCallback();
                    }
                });
            }
            catch (error) {
                const errorMessage = error.message || error.toString();
                console.error('Account creation error:', errorMessage);
                // Check for specific error conditions
                if (errorMessage.includes('already exists')) {
                    vscode.window.showWarningMessage(`Account ${accountId} already exists. Would you like to import it instead?`, 'Import Account').then(selection => {
                        if (selection === 'Import Account') {
                            this.importCreatedAccount(accountId, network, refreshCallback);
                        }
                    });
                }
                else if (errorMessage.includes('near-cli-rs') || errorMessage.includes('command not found') || errorMessage.includes('near: command not found')) {
                    vscode.window.showErrorMessage('NEAR CLI is not installed or not in PATH. Please install near-cli-rs: cargo install near-cli-rs', 'Install Instructions').then(selection => {
                        if (selection === 'Install Instructions') {
                            vscode.env.openExternal(vscode.Uri.parse('https://github.com/near/near-cli-rs#installation'));
                        }
                    });
                }
                else {
                    // Only show error if it's an actual failure
                    vscode.window.showErrorMessage(`Failed to create account: ${errorMessage}`);
                }
            }
        });
    }
    async importCreatedAccount(accountId, network, refreshCallback) {
        try {
            // Check if the account exists and get its keys
            const keyPath = this.getDefaultKeyPath(accountId, network);
            vscode.window.showInformationMessage(`Account ${accountId} should now be available in your local NEAR CLI configuration.`, 'Refresh Accounts').then(selection => {
                if (selection === 'Refresh Accounts') {
                    refreshCallback();
                }
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to import account: ${error.message}`);
        }
    }
    getDefaultKeyPath(accountId, network) {
        const os = require('os');
        const path = require('path');
        return path.join(os.homedir(), '.near-credentials', network, `${accountId}.json`);
    }
    async handleMainnetCreation() {
        vscode.window.showInformationMessage('Mainnet accounts must be created through NEAR Wallet.', 'Open NEAR Wallet').then(selection => {
            if (selection === 'Open NEAR Wallet') {
                vscode.env.openExternal(vscode.Uri.parse('https://wallet.near.org'));
            }
        });
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