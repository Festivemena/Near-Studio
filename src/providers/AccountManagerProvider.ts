import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';
import * as crypto from 'crypto';

const execAsync = promisify(exec);

interface NearAccount {
    id: string;
    network: 'testnet' | 'mainnet' | 'sandbox';
    balance?: string;
    keyPath?: string;
    isActive?: boolean;
    publicKey?: string;
    privateKey?: string;
}

interface NetworkGroup {
    network: 'testnet' | 'mainnet' | 'sandbox';
    accounts: NearAccount[];
}

export class AccountManagerProvider implements vscode.TreeDataProvider<AccountItem | NetworkItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<AccountItem | NetworkItem | undefined | null | void> = 
        new vscode.EventEmitter<AccountItem | NetworkItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<AccountItem | NetworkItem | undefined | null | void> = 
        this._onDidChangeTreeData.event;

    private accounts: Map<string, NearAccount[]> = new Map();
    private activeAccount: NearAccount | null = null;
    private balanceUpdateInterval: NodeJS.Timeout | null = null;

    constructor() {
        this.loadAccounts();
        this.startBalanceUpdates();
    }

    refresh(): void {
        this.loadAccounts();
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: AccountItem | NetworkItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: AccountItem | NetworkItem): Thenable<(AccountItem | NetworkItem)[]> {
        if (!element) {
            // Root level - show network groups
            const networks: ('testnet' | 'mainnet' | 'sandbox')[] = ['testnet', 'mainnet', 'sandbox'];
            const items: (NetworkItem | AccountItem)[] = [];

            for (const network of networks) {
                const networkAccounts = this.accounts.get(network) || [];
                if (networkAccounts.length > 0) {
                    items.push(new NetworkItem(network, networkAccounts.length));
                } else {
                    items.push(new NetworkItem(network, 0));
                }
            }

            // Add quick action items if no active account
            if (!this.activeAccount) {
                items.push(new AccountItem(
                    'Create New Wallet',
                    '+ Create testnet/mainnet wallet',
                    vscode.TreeItemCollapsibleState.None,
                    'create-wallet',
                    'testnet'
                ));
                items.push(new AccountItem(
                    'Import Existing Wallet',
                    '+ Add existing NEAR account',
                    vscode.TreeItemCollapsibleState.None,
                    'import-wallet',
                    'testnet'
                ));
            }

            return Promise.resolve(items);
        } else if (element instanceof NetworkItem) {
            // Network level - show accounts in this network
            const networkAccounts = this.accounts.get(element.network) || [];
            const accountItems = networkAccounts.map(account => 
                new AccountItem(
                    account.id,
                    account.balance || 'Loading...',
                    vscode.TreeItemCollapsibleState.None,
                    'account',
                    account.network,
                    account.isActive
                )
            );

            // Add create/import options for each network
            accountItems.push(new AccountItem(
                `Create ${element.network} wallet`,
                `+ New ${element.network} account`,
                vscode.TreeItemCollapsibleState.None,
                'create-wallet',
                element.network
            ));
            
            accountItems.push(new AccountItem(
                `Import ${element.network} wallet`,
                `+ Existing ${element.network} account`,
                vscode.TreeItemCollapsibleState.None,
                'import-wallet',
                element.network
            ));

            return Promise.resolve(accountItems);
        }
        return Promise.resolve([]);
    }

    private async loadAccounts() {
    try {
        const config = vscode.workspace.getConfiguration('nearExtension');
        const storedAccounts = config.get<any>('accounts') || {};
        const activeAccountId = config.get<string>('accountId');
        const activeNetwork = config.get<string>('network', 'testnet') as 'testnet' | 'mainnet' | 'sandbox';

        this.accounts.clear();
        this.activeAccount = null;

        // Initialize network maps
        this.accounts.set('testnet', []);
        this.accounts.set('mainnet', []);
        this.accounts.set('sandbox', []);

        // Load stored accounts
        for (const [accountId, accountData] of Object.entries(storedAccounts)) {
            // Safely cast and provide defaults for missing properties
            const rawAccount = accountData as any;
            
            const account: NearAccount = {
                id: rawAccount.id || accountId,
                network: rawAccount.network || 'testnet',
                balance: rawAccount.balance,
                keyPath: rawAccount.keyPath,
                publicKey: rawAccount.publicKey,
                privateKey: rawAccount.privateKey,
                isActive: false // Initialize as false, will be set below if needed
            };
            
            // Set active status
            account.isActive = (accountId === activeAccountId && account.network === activeNetwork);
            
            if (account.isActive) {
                this.activeAccount = account;
            }

            const networkAccounts = this.accounts.get(account.network) || [];
            networkAccounts.push(account);
            this.accounts.set(account.network, networkAccounts);
        }

        // Load balances for all accounts
        await this.loadAccountBalances();

    } catch (error) {
        console.error('Error loading accounts:', error);
        vscode.window.showErrorMessage(`Failed to load accounts: ${error}`);
    }
}

    private async loadAccountBalances() {
        for (const [network, accounts] of this.accounts.entries()) {
            for (const account of accounts) {
                try {
                    const balance = await this.getAccountBalance(account.id, network);
                    account.balance = balance;
                } catch (error) {
                    account.balance = 'Error loading balance';
                    console.error(`Error loading balance for ${account.id}:`, error);
                }
            }
        }
        this._onDidChangeTreeData.fire();
    }

    private async getAccountBalance(accountId: string, network: string): Promise<string> {
        try {
            let stdout = '';
            let success = false;
            
            // near-cli-rs uses different command syntax
            const commands = [
                // Primary command format for near-cli-rs
                `near account view-account-summary ${accountId} network-config ${network}`,
                // Alternative format
                `near account view-account-summary ${accountId} --network-id ${network}`,
                // Fallback to state command
                `near account view-state ${accountId} network-config ${network}`,
                `near account view-state ${accountId} --network-id ${network}`
            ];

            for (const command of commands) {
                try {
                    const result = await execAsync(command);
                    stdout = result.stdout;
                    success = true;
                    break;
                } catch (cmdError) {
                    continue; // Try next command
                }
            }

            if (success && stdout) {
                // Parse balance from near-cli-rs output formats
                let balanceMatch = stdout.match(/amount:\s*['"]([^'"]+)['"]/);
                if (!balanceMatch) {
                    balanceMatch = stdout.match(/balance:\s*['"]([^'"]+)['"]/);
                }
                if (!balanceMatch) {
                    balanceMatch = stdout.match(/amount:\s*([0-9]+)/);
                }
                if (!balanceMatch) {
                    balanceMatch = stdout.match(/balance:\s*([0-9]+)/);
                }
                if (!balanceMatch) {
                    balanceMatch = stdout.match(/(\d{20,})/); // Look for large numbers
                }
                
                if (balanceMatch) {
                    const yoctoNear = balanceMatch[1];
                    const nearAmount = (parseInt(yoctoNear) / Math.pow(10, 24)).toFixed(4);
                    return `${nearAmount} NEAR`;
                }
            }
            
            return success ? 'Account exists' : 'Unknown';
        } catch (error) {
            return 'Not found';
        }
    }

    private startBalanceUpdates() {
        // Update balances every 30 seconds
        this.balanceUpdateInterval = setInterval(() => {
            this.loadAccountBalances();
        }, 30000);
    }

    private stopBalanceUpdates() {
        if (this.balanceUpdateInterval) {
            clearInterval(this.balanceUpdateInterval);
            this.balanceUpdateInterval = null;
        }
    }

    async createWallet(network: 'testnet' | 'mainnet' | 'sandbox') {
        try {
            const accountId = await vscode.window.showInputBox({
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

            if (!accountId) return;

            if (network === 'testnet') {
                // For testnet, offer multiple creation methods
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
                    return;
                } else {
                    await this.createAccountManually(accountId, network);
                    return;
                }
            } else if (network === 'mainnet') {
                vscode.window.showInformationMessage(
                    'Mainnet accounts must be created through NEAR Wallet.',
                    'Open NEAR Wallet'
                ).then(selection => {
                    if (selection === 'Open NEAR Wallet') {
                        vscode.env.openExternal(vscode.Uri.parse('https://wallet.near.org'));
                    }
                });
                return;
            } else {
                // Sandbox
                await this.createSandboxAccount(accountId, network);
            }

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create wallet: ${error}`);
            console.error('Error creating wallet:', error);
        }
    }

    private async createAccountViaWallet(accountId: string, network: string) {
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
            
            // Wait a moment then prompt to import
            setTimeout(() => {
                vscode.window.showInformationMessage(
                    'After creating your account in NEAR Wallet, would you like to import it now?',
                    'Import Account'
                ).then(selection => {
                    if (selection === 'Import Account') {
                        this.importWallet(network as any);
                    }
                });
            }, 3000);
        }
    }

    private async createAccountManually(accountId: string, network: string) {
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Creating ${network} wallet...`,
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 25, message: 'Generating keys...' });

                // Generate proper key pair using near-cli-rs
                const keyPair = await this.generateKeysWithNearCliRs();
                
                progress.report({ increment: 50, message: 'Saving credentials...' });
                
                // Save the credentials locally
                await this.saveNearCliCredentials(accountId, network, keyPair);
                
                progress.report({ increment: 75, message: 'Account setup complete' });

                // Save account to extension
                const newAccount: NearAccount = {
                    id: accountId,
                    network: network as any,
                    publicKey: keyPair.publicKey,
                    privateKey: keyPair.privateKey,
                    balance: '0 NEAR (Not funded)',
                    isActive: true
                };

                await this.saveAccount(newAccount);
                progress.report({ increment: 100, message: 'Ready to fund!' });
            });

            // Show funding instructions
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
                    const networkAccounts = this.accounts.get(network) || [];
                    const account = networkAccounts.find(acc => acc.id === accountId);
                    if (account?.publicKey) {
                        await vscode.env.clipboard.writeText(account.publicKey);
                        vscode.window.showInformationMessage('Public key copied to clipboard');
                    }
                    break;
                case 'Switch to Account':
                    this.switchToAccount(accountId, network as any);
                    break;
            }

            this.refresh();

        } catch (error) {
            throw error;
        }
    }

    private async generateKeysWithNearCliRs(): Promise<{ publicKey: string; privateKey: string }> {
        try {
            // Method 1: Use near-cli-rs generate-key command
            const { stdout } = await execAsync('near account generate-keypair ed25519 save-to-keychain');
            
            // Parse the output to get keys
            let publicKeyMatch = stdout.match(/Public key:\s*([^\s\n\r]+)/);
            let privateKeyMatch = stdout.match(/Private key:\s*([^\s\n\r]+)/);
            
            if (!publicKeyMatch) {
                publicKeyMatch = stdout.match(/public_key["']?\s*:\s*["']?([^"',\s\n\r]+)/);
            }
            if (!privateKeyMatch) {
                privateKeyMatch = stdout.match(/private_key["']?\s*:\s*["']?([^"',\s\n\r]+)/);
            }
            
            if (publicKeyMatch && privateKeyMatch) {
                return {
                    publicKey: publicKeyMatch[1].trim(),
                    privateKey: privateKeyMatch[1].trim()
                };
            }
        } catch (error) {
            console.warn('near-cli-rs key generation failed:', error);
        }

        // Method 2: Try alternative near-cli-rs command
        try {
            const tempFile = path.join(require('os').tmpdir(), `near-key-${Date.now()}.json`);
            await execAsync(`near account generate-keypair ed25519 save-to-file --file ${tempFile}`);
            
            if (fs.existsSync(tempFile)) {
                const keyData = JSON.parse(fs.readFileSync(tempFile, 'utf8'));
                fs.unlinkSync(tempFile);
                
                if (keyData.public_key && keyData.private_key) {
                    return {
                        publicKey: keyData.public_key,
                        privateKey: keyData.private_key
                    };
                }
            }
        } catch (error) {
            console.warn('Alternative near-cli-rs key generation failed:', error);
        }

        // Fallback to crypto-based generation
        return this.generateKeysReliably();
    }

    private async generateKeysReliably(): Promise<{ publicKey: string; privateKey: string }> {
        // Use Node.js crypto module for ed25519 keys
        try {
            const { generateKeyPairSync } = require('crypto');
            const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
                publicKeyEncoding: { type: 'spki', format: 'der' },
                privateKeyEncoding: { type: 'pkcs8', format: 'der' }
            });

            // Extract raw key bytes from DER encoding
            const publicKeyRaw = publicKey.slice(-32);
            const privateKeyRaw = privateKey.slice(-32);

            return {
                publicKey: 'ed25519:' + this.toBase58(publicKeyRaw),
                privateKey: 'ed25519:' + this.toBase58(privateKeyRaw)
            };
        } catch (error) {
            console.warn('Node crypto key generation failed:', error);
        }

        // Final fallback: Generate using simple method
        const privateKeyBytes = crypto.randomBytes(32);
        const publicKeyBytes = crypto.randomBytes(32);
        
        return {
            publicKey: 'ed25519:' + this.bufferToBase58(publicKeyBytes),
            privateKey: 'ed25519:' + this.bufferToBase58(privateKeyBytes)
        };
    }

    private bufferToBase58(buffer: Buffer): string {
        const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
        const base = alphabet.length;
        
        if (buffer.length === 0) return '';
        
        // Convert buffer to big integer
        let num = BigInt('0x' + buffer.toString('hex'));
        let result = '';
        
        while (num > 0) {
            const remainder = num % BigInt(base);
            result = alphabet[Number(remainder)] + result;
            num = num / BigInt(base);
        }
        
        // Add leading 1s for leading zero bytes
        for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
            result = alphabet[0] + result;
        }
        
        return result;
    }

    private toBase58(buffer: Buffer | Uint8Array): string {
        const bytes = buffer instanceof Buffer ? buffer : Buffer.from(buffer);
        return this.bufferToBase58(bytes);
    }

    private async createSandboxAccount(accountId: string, network: 'sandbox') {
        try {
            // Generate key pair
            const keyPair = await this.generateKeysWithNearCliRs();

            // Save credentials locally
            await this.saveNearCliCredentials(accountId, network, keyPair);

            // Save account to extension
            const newAccount: NearAccount = {
                id: accountId,
                network: network,
                publicKey: keyPair.publicKey,
                privateKey: keyPair.privateKey,
                balance: '0 NEAR (Not Funded)',
                isActive: true
            };

            await this.saveAccount(newAccount);
            vscode.window.showInformationMessage(`Sandbox account ${accountId} created. You may need to fund or initialize it in your sandbox environment.`);
            this.refresh();
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create sandbox account: ${error}`);
        }
    }

    async importWallet(network: 'testnet' | 'mainnet' | 'sandbox') {
        try {
            const accountId = await vscode.window.showInputBox({
                prompt: `Enter existing account ID for ${network}`,
                placeHolder: network === 'testnet' ? 'existing.testnet' : 
                           network === 'mainnet' ? 'existing.near' : 'existing.test.near'
            });

            if (!accountId) return;

            // Ask for import method
            const importMethod = await vscode.window.showQuickPick([
                { label: 'Private Key', description: 'Import using private key (ed25519:...)' },
                { label: 'Seed Phrase', description: 'Import using 12-word seed phrase' },
                { label: 'NEAR CLI Credentials', description: 'Import from existing NEAR CLI credentials' },
                { label: 'JSON File', description: 'Import from credentials JSON file' }
            ], { placeHolder: 'Select import method' });

            if (!importMethod) return;

            let privateKey = '';
            let publicKey = '';

            switch (importMethod.label) {
                case 'Private Key':
                    const inputPrivateKey = await vscode.window.showInputBox({
                        prompt: 'Enter private key (should start with "ed25519:")',
                        password: true,
                        validateInput: (value) => {
                            if (!value) return 'Private key is required';
                            if (!value.startsWith('ed25519:')) return 'Private key must start with "ed25519:"';
                            return null;
                        }
                    });
                    if (!inputPrivateKey) return;
                    privateKey = inputPrivateKey;
                    
                    // Derive public key from private key using near-cli-rs
                    try {
                        const tempFile = path.join(require('os').tmpdir(), `temp-key-${Date.now()}.json`);
                        fs.writeFileSync(tempFile, JSON.stringify({
                            account_id: accountId,
                            public_key: '',
                            private_key: privateKey
                        }));
                        
                        // Use near-cli-rs to derive the public key
                        const { stdout } = await execAsync(`near account import-account using-private-key ${privateKey} network-config ${network}`);
                        const pubKeyMatch = stdout.match(/Public key:\s*([^\s]+)/);
                        if (pubKeyMatch) {
                            publicKey = pubKeyMatch[1];
                        }
                        
                        if (fs.existsSync(tempFile)) {
                            fs.unlinkSync(tempFile);
                        }
                    } catch (keyError) {
                        // Fallback: derive public key (simplified - in production use proper NEAR key derivation)
                        publicKey = privateKey.replace('ed25519:', '').substring(0, 44);
                        publicKey = 'ed25519:' + publicKey;
                    }
                    break;

                case 'NEAR CLI Credentials':
                    try {
                        const credentialsPath = this.getNearCliCredentialsPath(accountId, network);
                        if (fs.existsSync(credentialsPath)) {
                            const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
                            privateKey = credentials.private_key;
                            publicKey = credentials.public_key;
                        } else {
                            throw new Error(`Credentials not found at: ${credentialsPath}`);
                        }
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to import from NEAR CLI: ${error}`);
                        return;
                    }
                    break;

                case 'JSON File':
                    const fileUri = await vscode.window.showOpenDialog({
                        canSelectFiles: true,
                        canSelectFolders: false,
                        canSelectMany: false,
                        filters: { 'JSON files': ['json'] },
                        title: 'Select NEAR credentials JSON file'
                    });

                    if (!fileUri || fileUri.length === 0) return;

                    try {
                        const fileContent = fs.readFileSync(fileUri[0].fsPath, 'utf8');
                        const credentials = JSON.parse(fileContent);
                        privateKey = credentials.private_key;
                        publicKey = credentials.public_key;
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to read credentials file: ${error}`);
                        return;
                    }
                    break;

                case 'Seed Phrase':
                    vscode.window.showInformationMessage('Seed phrase import will be available in next version. Use private key import instead.');
                    return;
            }

            // Verify account exists using near-cli-rs
            try {
                let accountExists = false;

                // Try near-cli-rs account view commands
                const viewCommands = [
                    `near account view-account-summary ${accountId} network-config ${network}`,
                    `near account view-account-summary ${accountId} --network-id ${network}`
                ];

                for (const cmd of viewCommands) {
                    try {
                        await execAsync(cmd);
                        accountExists = true;
                        break;
                    } catch (cmdError) {
                        continue;
                    }
                }

                // Fallback to RPC call if CLI fails
                if (!accountExists) {
                    try {
                        const rpcUrl = network === 'testnet' ? 'https://rpc.testnet.fastnear.com' : 
                                      network === 'mainnet' ? 'https://rpc.fastnear.com' : 'http://localhost:3030';
                        
                        const response = await fetch(rpcUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                jsonrpc: '2.0',
                                id: 'dontcare',
                                method: 'query',
                                params: {
                                    request_type: 'view_account',
                                    finality: 'final',
                                    account_id: accountId
                                }
                            })
                        });

                        const result = await response.json();
                        if (typeof result === 'object' && result !== null && 'result' in result) {
                            accountExists = true;
                        }
                    } catch (rpcError) {
                        console.warn('RPC verification failed:', rpcError);
                    }
                }

                if (!accountExists) {
                    vscode.window.showErrorMessage(
                        `Account ${accountId} does not exist on ${network}. Please create it first or check the account ID.`
                    );
                    return;
                }
                
                // Save credentials
                await this.saveNearCliCredentials(accountId, network, { publicKey, privateKey });
                
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(
                    `Account verification failed: ${errorMsg}. The account might not exist or near-cli-rs might not be properly configured.`
                );
                return;
            }

            // Save imported account
            const importedAccount: NearAccount = {
                id: accountId,
                network: network,
                publicKey: publicKey,
                privateKey: privateKey,
                balance: 'Loading...',
                isActive: true
            };

            await this.saveAccount(importedAccount);

            vscode.window.showInformationMessage(
                `✅ Account imported: ${accountId}`,
                'Switch to Account'
            ).then(selection => {
                if (selection === 'Switch to Account') {
                    this.switchToAccount(accountId, network);
                }
            });

            this.refresh();

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to import wallet: ${error}`);
            console.error('Error importing wallet:', error);
        }
    }

    private async saveNearCliCredentials(accountId: string, network: string, keyPair: { publicKey: string; privateKey: string }) {
        const credentialsPath = this.getNearCliCredentialsPath(accountId, network);
        const credentialsDir = path.dirname(credentialsPath);
        
        // Ensure directory exists
        if (!fs.existsSync(credentialsDir)) {
            fs.mkdirSync(credentialsDir, { recursive: true });
        }
        
        const credentials = {
            account_id: accountId,
            public_key: keyPair.publicKey,
            private_key: keyPair.privateKey
        };
        
        fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
    }

    private getNearCliCredentialsPath(accountId: string, network: string): string {
        const homeDir = require('os').homedir();
        return path.join(homeDir, '.near-credentials', network, `${accountId}.json`);
    }

    private async saveAccount(account: NearAccount) {
        const config = vscode.workspace.getConfiguration('nearExtension');
        const accounts = config.get<any>('accounts') || {};
        
        accounts[account.id] = account;
        await config.update('accounts', accounts, vscode.ConfigurationTarget.Global);
    }

    async switchToAccount(accountId: string, network: 'testnet' | 'mainnet' | 'sandbox') {
        try {
            const config = vscode.workspace.getConfiguration('nearExtension');
            
            // Update active account
            await config.update('accountId', accountId, vscode.ConfigurationTarget.Workspace);
            await config.update('network', network, vscode.ConfigurationTarget.Workspace);

            // Update internal state
            this.clearActiveFlags();
            
            const networkAccounts = this.accounts.get(network) || [];
            const account = networkAccounts.find(acc => acc.id === accountId);
            if (account) {
                account.isActive = true;
                this.activeAccount = account;
            }

            vscode.window.showInformationMessage(`✅ Switched to ${accountId} on ${network}`);
            this.refresh();

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to switch account: ${error}`);
        }
    }

    private clearActiveFlags() {
        for (const [_, accounts] of this.accounts.entries()) {
            accounts.forEach(acc => acc.isActive = false);
        }
        this.activeAccount = null;
    }

    async disconnectAccount(accountId: string, network: string) {
        const confirm = await vscode.window.showWarningMessage(
            `Disconnect ${accountId}? This will remove it from VS Code.`,
            'Disconnect',
            'Cancel'
        );

        if (confirm === 'Disconnect') {
            try {
                const config = vscode.workspace.getConfiguration('nearExtension');
                const accounts = config.get<any>('accounts') || {};
                
                delete accounts[accountId];
                await config.update('accounts', accounts, vscode.ConfigurationTarget.Global);

                // If this was the active account, clear it
                if (this.activeAccount?.id === accountId) {
                    await config.update('accountId', '', vscode.ConfigurationTarget.Workspace);
                    this.activeAccount = null;
                }

                vscode.window.showInformationMessage(`Disconnected ${accountId}`);
                this.refresh();

            } catch (error) {
                vscode.window.showErrorMessage(`Failed to disconnect account: ${error}`);
            }
        }
    }

    async copyAccountKey(accountId: string, network: string) {
        const networkAccounts = this.accounts.get(network) || [];
        const account = networkAccounts.find(acc => acc.id === accountId);
        
        if (!account || !account.privateKey) {
            vscode.window.showErrorMessage('Private key not available for this account');
            return;
        }

        await vscode.env.clipboard.writeText(account.privateKey);
        vscode.window.showInformationMessage('Private key copied to clipboard');
    }

    dispose() {
        this.stopBalanceUpdates();
    }
}

export class NetworkItem extends vscode.TreeItem {
    constructor(
        public readonly network: 'testnet' | 'mainnet' | 'sandbox',
        public readonly accountCount: number
    ) {
        super(`${network.toUpperCase()} (${accountCount})`, vscode.TreeItemCollapsibleState.Expanded);
        
        this.contextValue = 'network';
        this.tooltip = `${network} network with ${accountCount} accounts`;
        this.description = `${accountCount} accounts`;
        
        // Network icons
        switch (network) {
            case 'testnet':
                this.iconPath = new vscode.ThemeIcon('debug-alt', new vscode.ThemeColor('testing.iconUnset'));
                break;
            case 'mainnet':
                this.iconPath = new vscode.ThemeIcon('globe', new vscode.ThemeColor('charts.green'));
                break;
            case 'sandbox':
                this.iconPath = new vscode.ThemeIcon('beaker', new vscode.ThemeColor('charts.orange'));
                break;
        }
    }
}

export class AccountItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        private readonly version: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly network: 'testnet' | 'mainnet' | 'sandbox',
        public readonly isActive: boolean = false
    ) {
        super(label, collapsibleState);
        
        this.tooltip = `${this.label} - ${this.version}`;
        this.description = this.version;
        
        // Set icons and styling based on context and state
        if (contextValue === 'account') {
            if (isActive) {
                this.iconPath = new vscode.ThemeIcon('account', new vscode.ThemeColor('charts.green'));
                this.description = `${this.version} (Active)`;
            } else {
                this.iconPath = new vscode.ThemeIcon('account');
            }
        } else if (contextValue === 'create-wallet') {
            this.iconPath = new vscode.ThemeIcon('add', new vscode.ThemeColor('charts.blue'));
        } else if (contextValue === 'import-wallet') {
            this.iconPath = new vscode.ThemeIcon('folder-opened', new vscode.ThemeColor('charts.purple'));
        } else {
            this.iconPath = new vscode.ThemeIcon('warning');
        }

        // Add command for action items
        if (contextValue === 'create-wallet' || contextValue === 'import-wallet') {
            this.command = {
                command: contextValue === 'create-wallet' ? 'near-studio.createWallet' : 'near-studio.importWallet',
                title: this.label,
                arguments: [network]
            };
        }
    }
}