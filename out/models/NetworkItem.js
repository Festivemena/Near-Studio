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
exports.NetworkItem = void 0;
const vscode = __importStar(require("vscode"));
class NetworkItem extends vscode.TreeItem {
    constructor(network, accountCount) {
        super(`${network.toUpperCase()} (${accountCount})`, vscode.TreeItemCollapsibleState.Expanded);
        this.network = network;
        this.accountCount = accountCount;
        this.contextValue = 'network';
        this.tooltip = `${network} network with ${accountCount} accounts`;
        this.description = `${accountCount} accounts`;
        this.setNetworkIcon(network);
    }
    setNetworkIcon(network) {
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
exports.NetworkItem = NetworkItem;
//# sourceMappingURL=NetworkItem.js.map