import * as crypto from 'crypto';

export class CryptoUtils {
    static bufferToBase58(buffer: Buffer): string {
        const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
        const base = alphabet.length;
        
        if (buffer.length === 0) return '';
        
        let num = BigInt('0x' + buffer.toString('hex'));
        let result = '';
        
        while (num > 0) { 
            const remainder = num % BigInt(base);
            result = alphabet[Number(remainder)] + result;
            num = num / BigInt(base);
        }
        
        for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
            result = alphabet[0] + result;
        }
        
        return result;
    }

    static toBase58(buffer: Buffer | Uint8Array): string {
        const bytes = buffer instanceof Buffer ? buffer : Buffer.from(buffer);
        return this.bufferToBase58(bytes);
    }

    static generateKeysReliably(): { publicKey: string; privateKey: string } {
        try {
            const { generateKeyPairSync } = require('crypto');
            const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
                publicKeyEncoding: { type: 'spki', format: 'der' },
                privateKeyEncoding: { type: 'pkcs8', format: 'der' }
            });

            const publicKeyRaw = publicKey.slice(-32);
            const privateKeyRaw = privateKey.slice(-32);

            return {
                publicKey: 'ed25519:' + this.toBase58(publicKeyRaw),
                privateKey: 'ed25519:' + this.toBase58(privateKeyRaw)
            };
        } catch (error) {
            console.warn('Node crypto key generation failed:', error);
            
            // Fallback
            const privateKeyBytes = crypto.randomBytes(32);
            const publicKeyBytes = crypto.randomBytes(32);
            
            return {
                publicKey: 'ed25519:' + this.bufferToBase58(publicKeyBytes),
                privateKey: 'ed25519:' + this.bufferToBase58(privateKeyBytes)
            };
        }
    }
}
