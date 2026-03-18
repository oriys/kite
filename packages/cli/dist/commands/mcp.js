import { Command } from 'commander';
import { startMcpServer } from '../mcp/server.js';
export const mcpCommand = new Command('mcp')
    .description('Start MCP server for AI tool integration (Claude Desktop, Cursor, etc.)')
    .action(async () => {
    try {
        await startMcpServer();
    }
    catch (err) {
        console.error(`MCP server error: ${err.message}`);
        process.exit(1);
    }
});
