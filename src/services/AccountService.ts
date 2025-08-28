import * as vscode from 'vscode';
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
            const storedAccounts = await this.credentialsService.loadStoredAccounts();
            const { accountId: activeAccountId, network: activeNetwork } = await this.credentialsService.getActiveAccountInfo();

            const accounts: Map<string, NearAccount[]> = new Map();
            let activeAccount: NearAccount | null = null;

            // Initialize network maps
            accounts.set('testnet', []);
            accounts.set('mainnet', []);
            accounts.set('sandbox', []);

            // Load stored accounts
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

            // Load balances for all accounts
            await this.balanceService.loadBalancesForAccounts(accounts);

            return { accounts, activeAccount };

        } catch (error) {
            console.error('Error loading accounts:', error);
            vscode.window.showErrorMessage(`Failed to load accounts: ${error}`);
            return { accounts: new Map(), activeAccount: null };
        }
    }

    async switchToAccount(accountId: string, network: 'testnet' | 'mainnet' | 'sandbox', accounts: Map<string, NearAccount[]>): Promise<NearAccount | null> {
        try {
            await this.credentialsService.updateActiveAccount(accountId, network);

            // Update internal state
            this.clearActiveFlags(accounts);
            
            const networkAccounts = accounts.get(network) || [];
            const account = networkAccounts.find(acc => acc.id === accountId);
            if (account) {
                account.isActive = true;
                return account;
            }

            vscode.window.showInformationMessage(`✅ Switched to ${accountId} on ${network}`);
            return account || null;

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
            `Disconnect ${accountId}? This will remove it from VS Code.`,
            'Disconnect',
            'Cancel'
        );

        if (confirm === 'Disconnect') {
            try {
                await this.credentialsService.removeAccount(accountId);

                // If this was the active account, clear it
                const { accountId: activeAccountId } = await this.credentialsService.getActiveAccountInfo();
                if (activeAccountId === accountId) {
                    await this.credentialsService.updateActiveAccount('', 'testnet');
                }

                vscode.window.showInformationMessage(`Disconnected ${accountId}`);
                return true;

            } catch (error) {
                vscode.window.showErrorMessage(`Failed to disconnect account: ${error}`);
                return false;
            }
        }
        return false;
    }

    async copyAccountKey(accountId: string, network: string, accounts: Map<string, NearAccount[]>): Promise<void> {
        const networkAccounts = accounts.get(network) || [];
        const account = networkAccounts.find(acc => acc.id === accountId);
        
        if (!account || !account.privateKey) {
            vscode.window.showErrorMessage('Private key not available for this account');
            return;
        }

        await vscode.env.clipboard.writeText(account.privateKey);
        vscode.window.showInformationMessage('Private key copied to clipboard');
    }
}
