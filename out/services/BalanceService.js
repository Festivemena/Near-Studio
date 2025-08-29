"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BalanceService = void 0;
const nearCliUtils_1 = require("../utils/nearCliUtils");
class BalanceService {
    async getAccountBalance(accountId, network) {
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
                    const result = await (0, nearCliUtils_1.execAsync)(command);
                    stdout = result.stdout;
                    success = true;
                    break;
                }
                catch (cmdError) {
                    continue;
                }
            }
            if (success && stdout) {
                return this.parseBalanceFromOutput(stdout);
            }
            return success ? 'Account exists' : 'Unknown';
        }
        catch (error) {
            return 'Not found';
        }
    }
    parseBalanceFromOutput(stdout) {
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
    async loadBalancesForAccounts(accountsMap) {
        for (const [network, accounts] of accountsMap.entries()) {
            for (const account of accounts) {
                try {
                    const balance = await this.getAccountBalance(account.id, network);
                    account.balance = balance;
                }
                catch (error) {
                    account.balance = 'Error loading balance';
                    console.error(`Error loading balance for ${account.id}:`, error);
                }
            }
        }
    }
}
exports.BalanceService = BalanceService;
//# sourceMappingURL=BalanceService.js.map