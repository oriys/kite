import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { apiRequest } from '../lib/api-client.js';
export const publishCommand = new Command('publish')
    .description('Publish a document')
    .requiredOption('--doc <slug>', 'Document slug or ID')
    .action(async (opts) => {
    const spinner = ora('Publishing…').start();
    try {
        // Resolve slug to document ID by listing and matching
        const listRes = await apiRequest(`/api/documents?q=${encodeURIComponent(opts.doc)}&page_size=50`);
        const data = await listRes.json();
        const doc = data.items.find((d) => d.slug === opts.doc || d.id === opts.doc);
        if (!doc) {
            spinner.fail(`Document "${opts.doc}" not found`);
            process.exit(1);
        }
        await apiRequest(`/api/documents/${doc.id}/transition`, {
            method: 'POST',
            body: JSON.stringify({ action: 'publish' }),
        });
        spinner.succeed(`Published ${chalk.bold(doc.title)} (${doc.slug})`);
    }
    catch (err) {
        spinner.fail('Publish failed');
        console.error(chalk.red(`  ${err.message}`));
        process.exit(1);
    }
});
