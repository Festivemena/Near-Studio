import * as vscode from 'vscode';

export class AccountManagerProvider implements vscode.TreeDataProvider<AccountItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<AccountItem | undefined | null | void> = 
        new vscode.EventEmitter<AccountItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<AccountItem | undefined | null | void> = 
        this._onDidChangeTreeData.event;

    private accounts: AccountItem[] = [];

    constructor() {
        this.loadAccounts();
    }

    refresh(): void {
        this.loadAccounts();
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: AccountItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: AccountItem): Thenable<AccountItem[]> {
        if (!element) {
            return Promise.resolve(this.accounts);
        }
        return Promise.resolve([]);
    }

    private loadAccounts() {
        const config = vscode.workspace.getConfiguration('nearExtension');
        const accountId = config.get<string>('accountId');
        const network = config.get<string>('network', 'testnet');
        
        this.accounts = [];
        
        if (accountId) {
            this.accounts.push(new AccountItem(
                accountId,
                `${network} account`,
                vscode.TreeItemCollapsibleState.None,
                'account'
            ));
        } else {
            this.accounts.push(new AccountItem(
                'No account configured',
                'Click "Add Account" to get started',
                vscode.TreeItemCollapsibleState.None,
                'no-account'
            ));
        }
    }
}

export class AccountItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        private readonly version: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label} - ${this.version}`;
        this.description = this.version;
        
        // Add icons
        if (contextValue === 'account') {
            this.iconPath = new vscode.ThemeIcon('account');
        } else {
            this.iconPath = new vscode.ThemeIcon('warning');
        }
    }
}
