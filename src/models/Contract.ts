export type ContractType = 'Rust' | 'JavaScript/TypeScript' | 'AssemblyScript';
export type ContractStatus = 'Built' | 'Not Built';

export interface Contract {
    name: string;
    type: ContractType;
    path: string;
    status: ContractStatus;
    uri?: string;
}
