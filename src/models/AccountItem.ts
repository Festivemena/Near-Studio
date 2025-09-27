import * as vscode from 'vscode';

export class AccountItem extends vscode.TreeItem {
    constructor(
        public readonly accountId: string,
        public readonly balance: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemType: 'account' | 'create-wallet' | 'import-wallet' | 'refresh-accounts',
        public readonly network: string,
        public readonly isActive: boolean = false
    ) {
        super(accountId, collapsibleState);

        this.tooltip = this.getTooltip();
        this.description = balance;
        this.contextValue = itemType;

        // Set icon based on type
        if (itemType === 'account') {
            this.iconPath = new vscode.ThemeIcon(
                isActive ? 'account' : 'circle-outline',
                isActive ? new vscode.ThemeColor('charts.green') : undefined
            );
            
            // Add command to switch account on click
            this.command = {
                command: 'near-studio.switchAccount',
                title: 'Switch to Account',
                arguments: [accountId, network]
            };
        } else if (itemType === 'create-wallet') {
            this.iconPath = new vscode.ThemeIcon('add');
            this.command = {
                command: 'near-studio.createWallet',
                title: 'Create Wallet',
                arguments: [network]
            };
        } else if (itemType === 'import-wallet') {
            this.iconPath = new vscode.ThemeIcon('archive');
            this.command = {
                command: 'near-studio.importWallet',
                title: 'Import Wallet',
                arguments: [network]
            };
        } else if (itemType === 'refresh-accounts') {
            this.iconPath = new vscode.ThemeIcon('refresh');
            this.command = {
                command: 'near-studio.refreshAccounts',
                title: 'Refresh Accounts'
            };
        }
    }

    private getTooltip(): string {
        if (this.itemType === 'account') {
            return `${this.accountId} on ${this.network}\nBalance: ${this.balance}${this.isActive ? '\n✅ Active' : ''}`;
        } else if (this.itemType === 'create-wallet') {
            return `Create a new ${this.network} wallet`;
        } else if (this.itemType === 'import-wallet') {
            return `Import an existing ${this.network} wallet`;
        } else if (this.itemType === 'refresh-accounts') {
            return 'Refresh accounts and scan .near-credentials directory';
        }
        return '';
    }
}