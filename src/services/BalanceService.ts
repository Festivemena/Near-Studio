import { execAsync } from '../utils/nearCliUtils';

export class BalanceService {
    async getAccountBalance(accountId: string, network: string): Promise<string> {
        try {
            let stdout = '';
            let success = false;
            
            const commands = [
                `near account view-account-summary ${accountId} network-config ${network}`,
                `near account view-account-summary ${accountId} --network-id ${network}`,
                `near account view-state ${accountId} network-config ${network}`,
                `near account view-state ${accountId} --network-id ${network}`
            ];

            for (const command of commands) {
                try {
                    const result = await execAsync(command);
                    stdout = result.stdout;
                    success = true;
                    break;
                } catch (cmdError) {
                    continue;
                }
            }

            if (success && stdout) {
                return this.parseBalanceFromOutput(stdout);
            }
            
            return success ? 'Account exists' : 'Unknown';
        } catch (error) {
            return 'Not found';
        }
    }

    private parseBalanceFromOutput(stdout: string): string {
        const balancePatterns = [
            /amount:\s*['"]([^'"]+)['"]/,
            /balance:\s*['"]([^'"]+)['"]/,
            /amount:\s*([0-9]+)/,
            /balance:\s*([0-9]+)/,
            /(\d{20,})/ // Look for large numbers
        ];
        
        for (const pattern of balancePatterns) {
            const match = stdout.match(pattern);
            if (match) {
                const yoctoNear = match[1];
                const nearAmount = (parseInt(yoctoNear) / Math.pow(10, 24)).toFixed(4);
                return `${nearAmount} NEAR`;
            }
        }
        
        return 'Account exists';
    }

    async loadBalancesForAccounts(accountsMap: Map<string, any[]>): Promise<void> {
        for (const [network, accounts] of accountsMap.entries()) {
            for (const account of accounts) {
                try {
                    const balance = await this.getAccountBalance(account.id, network);
                    account.balance = balance;
                } catch (error) {
                    account.balance = 'Error loading balance';
                    console.error(`Error loading balance for ${account.id}:`, error);
                }
            }
        }
    }
}
