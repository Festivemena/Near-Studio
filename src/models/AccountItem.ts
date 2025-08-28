import * as vscode from 'vscode';

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
        
        this.setupItemAppearance();
        this.setupCommands();
    }

    private setupItemAppearance() {
        if (this.contextValue === 'account') {
            if (this.isActive) {
                this.iconPath = new vscode.ThemeIcon('account', new vscode.ThemeColor('charts.green'));
                this.description = `${this.version} (Active)`;
            } else {
                this.iconPath = new vscode.ThemeIcon('account');
            }
        } else if (this.contextValue === 'create-wallet') {
            this.iconPath = new vscode.ThemeIcon('add', new vscode.ThemeColor('charts.blue'));
        } else if (this.contextValue === 'import-wallet') {
            this.iconPath = new vscode.ThemeIcon('folder-opened', new vscode.ThemeColor('charts.purple'));
        } else {
            this.iconPath = new vscode.ThemeIcon('warning');
        }
    }

    private setupCommands() {
        if (this.contextValue === 'create-wallet' || this.contextValue === 'import-wallet') {
            this.command = {
                command: this.contextValue === 'create-wallet' ? 'near-studio.createWallet' : 'near-studio.importWallet',
                title: this.label,
                arguments: [this.network]
            };
        }
    }
}
