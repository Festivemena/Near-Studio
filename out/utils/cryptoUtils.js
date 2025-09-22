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
exports.CryptoUtils = void 0;
const crypto = __importStar(require("crypto"));
class CryptoUtils {
    static bufferToBase58(buffer) {
        const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
        const base = alphabet.length;
        if (buffer.length === 0)
            return '';
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
    static toBase58(buffer) {
        const bytes = buffer instanceof Buffer ? buffer : Buffer.from(buffer);
        return this.bufferToBase58(bytes);
    }
    static generateKeysReliably() {
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
        }
        catch (error) {
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
exports.CryptoUtils = CryptoUtils;
//# sourceMappingURL=cryptoUtils.js.map