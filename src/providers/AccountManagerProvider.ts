import * as vscode from 'vscode';
import { NearAccount } from '../types/accountTypes';
import { NetworkItem, AccountItem } from '../models';
import { AccountService, BalanceService, WalletService } from '../services';

export class AccountManagerProvider implements vscode.TreeDataProvider<AccountItem | NetworkItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<AccountItem | NetworkItem | undefined | null | void> = 
        new vscode.EventEmitter<AccountItem | NetworkItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<AccountItem | NetworkItem | undefined | null | void> = 
        this._onDidChangeTreeData.event;

    private accounts: Map<string, NearAccount[]> = new Map();
    private activeAccount: NearAccount | null = null;
    private balanceUpdateInterval: NodeJS.Timeout | null = null;

    // Service instances
    private accountService = new AccountService();
    private balanceService = new BalanceService();
    private walletService = new WalletService();

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
            return this.getRootLevelItems();
        } else if (element instanceof NetworkItem) {
            return this.getNetworkLevelItems(element);
        }
        return Promise.resolve([]);
    }

    private async getRootLevelItems(): Promise<(NetworkItem | AccountItem)[]> {
        const networks: ('testnet' | 'mainnet' | 'sandbox')[] = ['testnet', 'mainnet', 'sandbox'];
        const items: (NetworkItem | AccountItem)[] = [];

        for (const network of networks) {
            const networkAccounts = this.accounts.get(network) || [];
            items.push(new NetworkItem(network, networkAccounts.length));
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

        return items;
    }

    private async getNetworkLevelItems(element: NetworkItem): Promise<AccountItem[]> {
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

        return accountItems;
    }

    private async loadAccounts(): Promise<void> {
        try {
            const result = await this.accountService.loadAccounts();
            this.accounts = result.accounts;
            this.activeAccount = result.activeAccount;
        } catch (error) {
            console.error('Error loading accounts:', error);
            vscode.window.showErrorMessage(`Failed to load accounts: ${error}`);
        }
    }

    private startBalanceUpdates(): void {
        this.balanceUpdateInterval = setInterval(async () => {
            try {
                await this.balanceService.loadBalancesForAccounts(this.accounts);
                this._onDidChangeTreeData.fire();
            } catch (error) {
                console.error('Error updating balances:', error);
            }
        }, 30000);
    }

    private stopBalanceUpdates(): void {
        if (this.balanceUpdateInterval) {
            clearInterval(this.balanceUpdateInterval);
            this.balanceUpdateInterval = null;
        }
    }

    // Public API methods that delegate to services
    async createWallet(network: 'testnet' | 'mainnet' | 'sandbox'): Promise<void> {
        await this.walletService.createWallet(network, this.accounts, this.refresh.bind(this));
    }

    async importWallet(network: 'testnet' | 'mainnet' | 'sandbox'): Promise<void> {
        await this.walletService.importWallet(network, this.accounts, this.refresh.bind(this));
    }

    async switchToAccount(accountId: string, network: 'testnet' | 'mainnet' | 'sandbox'): Promise<void> {
        const newActiveAccount = await this.accountService.switchToAccount(accountId, network, this.accounts);
        if (newActiveAccount) {
            this.activeAccount = newActiveAccount;
        }
        this.refresh();
    }

    async disconnectAccount(accountId: string, network: string): Promise<void> {
        const success = await this.accountService.disconnectAccount(accountId, network);
        if (success) {
            this.refresh();
        }
    }

    async copyAccountKey(accountId: string, network: string): Promise<void> {
        await this.accountService.copyAccountKey(accountId, network, this.accounts);
    }

    dispose(): void {
        this.stopBalanceUpdates();
    }
}
