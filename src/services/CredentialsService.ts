import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { NearAccount } from '../types/accountTypes';

export class CredentialsService {
    async saveNearCliCredentials(
        accountId: string, 
        network: string, 
        keyPair: { publicKey: string; privateKey: string }
    ): Promise<void> {
        const credentialsPath = this.getNearCliCredentialsPath(accountId, network);
        const credentialsDir = path.dirname(credentialsPath);
        
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

    getNearCliCredentialsPath(accountId: string, network: string): string {
        const homeDir = require('os').homedir();
        return path.join(homeDir, '.near-credentials', network, `${accountId}.json`);
    }

    async saveAccount(account: NearAccount): Promise<void> {
        const config = vscode.workspace.getConfiguration('nearExtension');
        const accounts = config.get<any>('accounts') || {};
        
        accounts[account.id] = account;
        await config.update('accounts', accounts, vscode.ConfigurationTarget.Global);
    }

    async loadStoredAccounts(): Promise<{ [key: string]: any }> {
        const config = vscode.workspace.getConfiguration('nearExtension');
        return config.get<any>('accounts') || {};
    }

    async getActiveAccountInfo(): Promise<{ accountId?: string; network: string }> {
        const config = vscode.workspace.getConfiguration('nearExtension');
        return {
            accountId: config.get<string>('accountId'),
            network: config.get<string>('network', 'testnet')
        };
    }

    async updateActiveAccount(accountId: string, network: string): Promise<void> {
        const config = vscode.workspace.getConfiguration('nearExtension');
        await config.update('accountId', accountId, vscode.ConfigurationTarget.Workspace);
        await config.update('network', network, vscode.ConfigurationTarget.Workspace);
    }

    async removeAccount(accountId: string): Promise<void> {
        const config = vscode.workspace.getConfiguration('nearExtension');
        const accounts = config.get<any>('accounts') || {};
        
        delete accounts[accountId];
        await config.update('accounts', accounts, vscode.ConfigurationTarget.Global);
    }

    loadCredentialsFromFile(filePath: string): { publicKey: string; privateKey: string } {
        if (fs.existsSync(filePath)) {
            const credentials = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            return {
                privateKey: credentials.private_key,
                publicKey: credentials.public_key
            };
        }
        throw new Error(`Credentials not found at: ${filePath}`);
    }
}
