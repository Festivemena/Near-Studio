import * as vscode from 'vscode';

export class NetworkItem extends vscode.TreeItem {
    constructor(
        public readonly network: 'testnet' | 'mainnet' | 'sandbox',
        public readonly accountCount: number
    ) {
        super(`${network.toUpperCase()} (${accountCount})`, vscode.TreeItemCollapsibleState.Expanded);
        
        this.contextValue = 'network';
        this.tooltip = `${network} network with ${accountCount} accounts`;
        this.description = `${accountCount} accounts`;
        
        this.setNetworkIcon(network);
    }

    private setNetworkIcon(network: string) {
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
