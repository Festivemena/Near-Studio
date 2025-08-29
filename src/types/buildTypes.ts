export interface BuildConfig {
    language: 'rust' | 'javascript' | 'typescript';
    projectPath: string;
    contractName: string;
    outputPath: string;
    optimization: boolean;
    debug: boolean;
}