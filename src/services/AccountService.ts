import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { NearAccount } from '../types/accountTypes';
import { CredentialsService } from './CredentialsService';
import { BalanceService } from './BalanceService';

export class AccountService {
    private credentialsService = new CredentialsService();
    private balanceService = new BalanceService();

    async loadAccounts(): Promise<{
        accounts: Map<string, NearAccount[]>,
        activeAccount: NearAccount | null
    }> {
        try {
            // Load from VS Code settings
            const storedAccounts = await this.credentialsService.loadStoredAccounts();
            const { accountId: activeAccountId, network: activeNetwork } = await this.credentialsService.getActiveAccountInfo();

            const accounts: Map<string, NearAccount[]> = new Map();
            let activeAccount: NearAccount | null = null;

            // Initialize network maps
            accounts.set('testnet', []);
            accounts.set('mainnet', []);

            // Load stored accounts from settings
            for (const [accountId, accountData] of Object.entries(storedAccounts)) {
                const rawAccount = accountData as any;
                
                const account: NearAccount = {
                    id: rawAccount.id || accountId,
                    network: rawAccount.network || 'testnet',
                    balance: rawAccount.balance,
                    keyPath: rawAccount.keyPath,
                    publicKey: rawAccount.publicKey,
                    privateKey: rawAccount.privateKey,
                    isActive: false
                };
                
                // Set active status
                account.isActive = (accountId === activeAccountId && account.network === activeNetwork);
                
                if (account.isActive) {
                    activeAccount = account;
                }

                const networkAccounts = accounts.get(account.network) || [];
                networkAccounts.push(account);
                accounts.set(account.network, networkAccounts);
            }

            // Scan .near-credentials directory for additional accounts
            await this.scanNearCredentials(accounts, storedAccounts);

            // Load balances for all accounts
            await this.balanceService.loadBalancesForAccounts(accounts);

            return { accounts, activeAccount };

        } catch (error) {
            console.error('Error loading accounts:', error);
            vscode.window.showErrorMessage(`Failed to load accounts: ${error}`);
            return { accounts: new Map(), activeAccount: null };
        }
    }

    private async scanNearCredentials(
        accounts: Map<string, NearAccount[]>, 
        storedAccounts: { [key: string]: any }
    ): Promise<void> {
        try {
            const homeDir = os.homedir();
            const credentialsDir = path.join(homeDir, '.near-credentials');

            if (!fs.existsSync(credentialsDir)) {
                return;
            }

            const networks: ('testnet' | 'mainnet')[] = ['testnet', 'mainnet'];

            for (const network of networks) {
                const networkDir = path.join(credentialsDir, network);
                
                if (!fs.existsSync(networkDir)) {
                    continue;
                }

                const files = fs.readdirSync(networkDir);
                
                for (const file of files) {
                    if (!file.endsWith('.json')) {
                        continue;
                    }

                    const accountId = file.replace('.json', '');
                    
                    // Skip if already loaded from settings
                    if (storedAccounts[accountId]) {
                        continue;
                    }

                    try {
                        const filePath = path.join(networkDir, file);
                        const credentials = JSON.parse(fs.readFileSync(filePath, 'utf8'));

                        const account: NearAccount = {
                            id: accountId,
                            network: network,
                            balance: 'Loading...',
                            publicKey: credentials.public_key,
                            privateKey: credentials.private_key,
                            keyPath: filePath,
                            isActive: false
                        };

                        // Auto-save discovered account to settings
                        await this.credentialsService.saveAccount(account);

                        const networkAccounts = accounts.get(network) || [];
                        networkAccounts.push(account);
                        accounts.set(network, networkAccounts);

                        console.log(`✅ Discovered account from .near-credentials: ${accountId} on ${network}`);
                    } catch (error) {
                        console.error(`Failed to load credentials for ${accountId}:`, error);
                    }
                }
            }
        } catch (error) {
            console.error('Error scanning .near-credentials:', error);
        }
    }

    async switchToAccount(accountId: string, network: string, accounts: Map<string, NearAccount[]>): Promise<NearAccount | null> {
        try {
            await this.credentialsService.updateActiveAccount(accountId, network);
            
            // Update internal state
            this.clearActiveFlags(accounts);
            const networkAccounts = accounts.get(network) || [];
            const account = networkAccounts.find(acc => acc.id === accountId);
            
            if (account) {
                account.isActive = true;
                vscode.window.showInformationMessage(`✅ Switched to ${accountId} on ${network}`);
                return account;
            }

            return null;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to switch account: ${error}`);
            return null;
        }
    }

    private clearActiveFlags(accounts: Map<string, NearAccount[]>): void {
        for (const [_, accountList] of accounts.entries()) {
            accountList.forEach(acc => acc.isActive = false);
        }
    }

    async disconnectAccount(accountId: string, network: string): Promise<boolean> {
        const confirm = await vscode.window.showWarningMessage(
            `Disconnect ${accountId}?`,
            { modal: true },
            'Disconnect',
            'Cancel'
        );

        if (confirm === 'Disconnect') {
            await this.credentialsService.removeAccount(accountId);
            vscode.window.showInformationMessage(`Disconnected ${accountId}`);
            return true;
        }

        return false;
    }

    async copyAccountKey(accountId: string, network: string, accounts: Map<string, NearAccount[]>): Promise<void> {
        const networkAccounts = accounts.get(network) || [];
        const account = networkAccounts.find(acc => acc.id === accountId);

        if (account?.privateKey) {
            await vscode.env.clipboard.writeText(account.privateKey);
            vscode.window.showInformationMessage(`Private key copied to clipboard for ${accountId}`);
        } else {
            vscode.window.showErrorMessage(`No private key found for ${accountId}`);
        }
    }
}