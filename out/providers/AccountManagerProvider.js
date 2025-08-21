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
exports.AccountItem = exports.AccountManagerProvider = void 0;
const vscode = __importStar(require("vscode"));
class AccountManagerProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.accounts = [];
        this.loadAccounts();
    }
    refresh() {
        this.loadAccounts();
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!element) {
            return Promise.resolve(this.accounts);
        }
        return Promise.resolve([]);
    }
    loadAccounts() {
        const config = vscode.workspace.getConfiguration('nearExtension');
        const accountId = config.get('accountId');
        const network = config.get('network', 'testnet');
        this.accounts = [];
        if (accountId) {
            this.accounts.push(new AccountItem(accountId, `${network} account`, vscode.TreeItemCollapsibleState.None, 'account'));
        }
        else {
            this.accounts.push(new AccountItem('No account configured', 'Click "Add Account" to get started', vscode.TreeItemCollapsibleState.None, 'no-account'));
        }
    }
}
exports.AccountManagerProvider = AccountManagerProvider;
class AccountItem extends vscode.TreeItem {
    constructor(label, version, collapsibleState, contextValue) {
        super(label, collapsibleState);
        this.label = label;
        this.version = version;
        this.collapsibleState = collapsibleState;
        this.contextValue = contextValue;
        this.tooltip = `${this.label} - ${this.version}`;
        this.description = this.version;
        // Add icons
        if (contextValue === 'account') {
            this.iconPath = new vscode.ThemeIcon('account');
        }
        else {
            this.iconPath = new vscode.ThemeIcon('warning');
        }
    }
}
exports.AccountItem = AccountItem;
//# sourceMappingURL=AccountManagerProvider.js.map