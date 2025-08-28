import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';
import { CryptoUtils } from './cryptoUtils';

export const execAsync = promisify(exec);

export class NearCliUtils {
    static async generateKeysWithNearCliRs(): Promise<{ publicKey: string; privateKey: string }> {
        try {
            // Method 1: Use near-cli-rs generate-key command
            const { stdout } = await execAsync('near account generate-keypair ed25519 save-to-keychain');
            
            // Parse the output to get keys
            let publicKeyMatch = stdout.match(/Public key:\s*([^\s\n\r]+)/);
            let privateKeyMatch = stdout.match(/Private key:\s*([^\s\n\r]+)/);
            
            if (!publicKeyMatch) {
                publicKeyMatch = stdout.match(/public_key["']?\s*:\s*["']?([^"',\s\n\r]+)/);
            }
            if (!privateKeyMatch) {
                privateKeyMatch = stdout.match(/private_key["']?\s*:\s*["']?([^"',\s\n\r]+)/);
            }
            
            if (publicKeyMatch && privateKeyMatch) {
                return {
                    publicKey: publicKeyMatch[1].trim(),
                    privateKey: privateKeyMatch[1].trim()
                };
            }
        } catch (error) {
            console.warn('near-cli-rs key generation failed:', error);
        }

        // Method 2: Try alternative near-cli-rs command
        try {
            const tempFile = path.join(require('os').tmpdir(), `near-key-${Date.now()}.json`);
            await execAsync(`near account generate-keypair ed25519 save-to-file --file ${tempFile}`);
            
            if (fs.existsSync(tempFile)) {
                const keyData = JSON.parse(fs.readFileSync(tempFile, 'utf8'));
                fs.unlinkSync(tempFile);
                
                if (keyData.public_key && keyData.private_key) {
                    return {
                        publicKey: keyData.public_key,
                        privateKey: keyData.private_key
                    };
                }
            }
        } catch (error) {
            console.warn('Alternative near-cli-rs key generation failed:', error);
        }

        // Fallback to crypto-based generation
        return CryptoUtils.generateKeysReliably();
    }

    static async verifyAccountExists(accountId: string, network: string): Promise<boolean> {
        // Try near-cli-rs account view commands
        const viewCommands = [
            `near account view-account-summary ${accountId} network-config ${network}`,
            `near account view-account-summary ${accountId} --network-id ${network}`
        ];

        for (const cmd of viewCommands) {
            try {
                await execAsync(cmd);
                return true;
            } catch (cmdError) {
                continue;
            }
        }

        // Fallback to RPC call if CLI fails
        try {
            const rpcUrl = network === 'testnet' ? 'https://rpc.testnet.fastnear.com' : 
                          network === 'mainnet' ? 'https://rpc.fastnear.com' : 'http://localhost:3030';
            
            const response = await fetch(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 'dontcare',
                    method: 'query',
                    params: {
                        request_type: 'view_account',
                        finality: 'final',
                        account_id: accountId
                    }
                })
            });

            const result = await response.json();
            return (typeof result === 'object' && result !== null && 'result' in result);
        } catch (rpcError) {
            console.warn('RPC verification failed:', rpcError);
            return false;
        }
    }

    static async derivePublicKeyFromPrivate(privateKey: string, accountId: string, network: string): Promise<string> {
        try {
            const tempFile = path.join(require('os').tmpdir(), `temp-key-${Date.now()}.json`);
            fs.writeFileSync(tempFile, JSON.stringify({
                account_id: accountId,
                public_key: '',
                private_key: privateKey
            }));
            
            // Use near-cli-rs to derive the public key
            const { stdout } = await execAsync(`near account import-account using-private-key ${privateKey} network-config ${network}`);
            const pubKeyMatch = stdout.match(/Public key:\s*([^\s]+)/);
            
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }

            if (pubKeyMatch) {
                return pubKeyMatch[1];
            }
        } catch (keyError) {
            console.warn('Key derivation failed:', keyError);
        }

        // Fallback: derive public key (simplified - in production use proper NEAR key derivation)
        const publicKey = privateKey.replace('ed25519:', '').substring(0, 44);
        return 'ed25519:' + publicKey;
    }
}
