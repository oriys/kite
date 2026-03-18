import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { apiRequest } from '../lib/api-client.js';
async function resolveSourceId(nameOrId) {
    const res = await apiRequest('/api/openapi');
    const data = (await res.json());
    const source = data.items.find((s) => s.id === nameOrId || s.name === nameOrId);
    if (!source)
        throw new Error(`OpenAPI source "${nameOrId}" not found`);
    return source;
}
const listCommand = new Command('list')
    .description('List OpenAPI sources')
    .action(async () => {
    const spinner = ora('Fetching sources…').start();
    try {
        const res = await apiRequest('/api/openapi');
        const data = (await res.json());
        spinner.stop();
        if (data.items.length === 0) {
            console.log(chalk.dim('  No OpenAPI sources found'));
            return;
        }
        for (const s of data.items) {
            const version = s.openapiVersion ? chalk.cyan(s.openapiVersion) : chalk.dim('unknown');
            const synced = s.lastSyncedAt ? chalk.dim(s.lastSyncedAt) : chalk.dim('never synced');
            console.log(`  ${chalk.bold(s.name)} ${version} ${chalk.dim(s.sourceType)} ${synced}`);
            console.log(`  ${chalk.dim(`id: ${s.id}`)}`);
            console.log();
        }
    }
    catch (err) {
        spinner.fail('Failed to list sources');
        console.error(chalk.red(`  ${err.message}`));
        process.exit(1);
    }
});
const endpointsCommand = new Command('endpoints')
    .description('List API endpoints from a source')
    .argument('<source>', 'Source name or ID')
    .action(async (nameOrId) => {
    const spinner = ora('Fetching endpoints…').start();
    try {
        const source = await resolveSourceId(nameOrId);
        const res = await apiRequest(`/api/openapi/${source.id}/endpoints`);
        const data = (await res.json());
        spinner.stop();
        const methodColors = {
            GET: chalk.green,
            POST: chalk.blue,
            PUT: chalk.yellow,
            PATCH: chalk.yellow,
            DELETE: chalk.red,
        };
        for (const ep of data.endpoints) {
            const colorFn = methodColors[ep.method.toUpperCase()] || chalk.white;
            const method = colorFn(ep.method.toUpperCase().padEnd(7));
            const deprecated = ep.deprecated ? chalk.dim(' [deprecated]') : '';
            console.log(`  ${method} ${ep.path}${deprecated}`);
            if (ep.summary)
                console.log(`  ${chalk.dim(ep.summary)}`);
        }
        console.log();
        console.log(chalk.dim(`  ${data.endpoints.length} endpoint${data.endpoints.length !== 1 ? 's' : ''}`));
    }
    catch (err) {
        spinner.fail('Failed to list endpoints');
        console.error(chalk.red(`  ${err.message}`));
        process.exit(1);
    }
});
const diffCommand = new Command('diff')
    .description('Show API changes from the last snapshot')
    .argument('<source>', 'Source name or ID')
    .action(async (nameOrId) => {
    const spinner = ora('Computing diff…').start();
    try {
        const source = await resolveSourceId(nameOrId);
        const res = await apiRequest(`/api/openapi/${source.id}/diff`);
        const data = (await res.json());
        spinner.stop();
        if (!data.changes || data.changes.length === 0) {
            console.log(chalk.green('  No changes detected'));
            return;
        }
        const typeColors = {
            added: chalk.green,
            removed: chalk.red,
            modified: chalk.yellow,
        };
        for (const c of data.changes) {
            const colorFn = typeColors[c.type] || chalk.white;
            const label = colorFn(c.type.padEnd(8));
            const endpoint = c.method && c.path ? `${c.method.toUpperCase()} ${c.path}` : '';
            console.log(`  ${label} ${endpoint}`);
            if (c.description)
                console.log(`  ${chalk.dim(c.description)}`);
        }
        if (data.summary) {
            console.log();
            console.log(chalk.dim(`  ${data.summary}`));
        }
    }
    catch (err) {
        spinner.fail('Diff failed');
        console.error(chalk.red(`  ${err.message}`));
        process.exit(1);
    }
});
const syncCommand = new Command('sync')
    .description('Sync an OpenAPI source from its URL')
    .argument('<source>', 'Source name or ID')
    .action(async (nameOrId) => {
    const spinner = ora('Syncing…').start();
    try {
        const source = await resolveSourceId(nameOrId);
        const res = await apiRequest(`/api/openapi/${source.id}/sync`, {
            method: 'POST',
        });
        const data = (await res.json());
        if (data.changed) {
            spinner.succeed(`Synced ${chalk.bold(source.name)} — changes detected`);
        }
        else {
            spinner.succeed(`Synced ${chalk.bold(source.name)} — no changes`);
        }
    }
    catch (err) {
        spinner.fail('Sync failed');
        console.error(chalk.red(`  ${err.message}`));
        process.exit(1);
    }
});
export const openapiCommand = new Command('openapi')
    .description('Manage OpenAPI sources')
    .addCommand(listCommand)
    .addCommand(endpointsCommand)
    .addCommand(diffCommand)
    .addCommand(syncCommand);
