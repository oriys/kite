import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { setApiToken, setBaseUrl, getBaseUrl, getApiToken } from '../lib/config.js';
export const loginCommand = new Command('login')
    .description('Authenticate with the Kite API')
    .option('--token <token>', 'API token (starts with kite_)')
    .option('--url <url>', 'Base URL of the Kite instance')
    .action(async (opts) => {
    if (opts.url) {
        setBaseUrl(opts.url);
        console.log(chalk.green('✓'), `Base URL set to ${opts.url}`);
    }
    if (opts.token) {
        if (!opts.token.startsWith('kite_')) {
            console.error(chalk.red('✗'), 'Invalid token format. Tokens start with "kite_".');
            process.exit(1);
        }
        const baseUrl = getBaseUrl();
        if (!baseUrl) {
            console.error(chalk.red('✗'), 'Base URL is not configured. Pass `--url <url>` or set KITE_BASE_URL.');
            process.exit(1);
        }
        const spinner = ora('Validating token…').start();
        try {
            const url = `${baseUrl}/api/tokens`;
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${opts.token}` },
            });
            if (!res.ok) {
                spinner.fail('Token validation failed');
                console.error(chalk.red('  The token is invalid or the server is unreachable.'));
                process.exit(1);
            }
            setApiToken(opts.token);
            spinner.succeed('Authenticated successfully');
        }
        catch (err) {
            spinner.fail('Could not connect to server');
            console.error(chalk.dim(`  ${err.message}`));
            process.exit(1);
        }
    }
    if (!opts.token && !opts.url) {
        const token = getApiToken();
        const baseUrl = getBaseUrl();
        console.log(chalk.bold('Current configuration:'));
        console.log(`  URL:   ${baseUrl ?? chalk.dim('not set')}`);
        console.log(`  Token: ${token ? token.slice(0, 12) + '…' : chalk.dim('not set')}`);
    }
});
