export interface NearAccount {
    id: string;
    network: 'testnet' | 'mainnet' | 'sandbox';
    balance?: string;
    keyPath?: string;
    isActive?: boolean;
    publicKey?: string;
    privateKey?: string;
}

export interface NetworkGroup {
    network: 'testnet' | 'mainnet' | 'sandbox';
    accounts: NearAccount[];
}