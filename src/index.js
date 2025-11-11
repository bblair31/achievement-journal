#!/usr/bin/env node

/**
 * Achievement Journal CLI
 * Collects activities from GitHub, ClickUp, and Notion
 */

import { config as loadEnv } from 'dotenv';
import { GitHubCollector } from './collectors/github.js';
import { ClickUpCollector } from './collectors/clickup.js';
import { NotionCollector } from './collectors/notion.js';
import { MarkdownFormatter } from './formatter.js';
import config from '../config.js';
import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Load environment variables
loadEnv();

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    period: null,
    startDate: null,
    endDate: null,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--period':
        options.period = args[++i];
        break;
      case '--start-date':
        options.startDate = new Date(args[++i]);
        break;
      case '--end-date':
        options.endDate = new Date(args[++i]);
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
    }
  }

  return options;
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
Achievement Journal CLI

Usage:
  npm run collect                    # Collect for default period (month)
  npm run collect:month              # Collect for last month
  npm run collect:week               # Collect for last week
  npm run collect -- --period week   # Custom period
  npm run collect -- --start-date 2025-01-01 --end-date 2025-01-31

Options:
  --period <period>          Time period: week, month, quarter, year
  --start-date <date>        Start date (YYYY-MM-DD)
  --end-date <date>          End date (YYYY-MM-DD)
  -h, --help                 Show this help message

Examples:
  npm run collect -- --period month
  npm run collect -- --start-date 2025-01-01 --end-date 2025-01-31
  `);
}

/**
 * Calculate date range based on period
 */
function calculateDateRange(period) {
  const endDate = new Date();
  const startDate = new Date();

  switch (period) {
    case 'week':
      startDate.setDate(endDate.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(endDate.getMonth() - 1);
      break;
    case 'quarter':
      startDate.setMonth(endDate.getMonth() - 3);
      break;
    case 'year':
      startDate.setFullYear(endDate.getFullYear() - 1);
      break;
    default:
      startDate.setMonth(endDate.getMonth() - 1); // Default to month
  }

  return { startDate, endDate };
}

/**
 * Main execution function
 */
async function main() {
  console.log('🎯 Achievement Journal Collector\n');

  // Parse arguments
  const options = parseArgs();

  // Determine date range
  let startDate, endDate;
  if (options.startDate && options.endDate) {
    startDate = options.startDate;
    endDate = options.endDate;
  } else {
    const period = options.period || config.dateRange.defaultPeriod;
    ({ startDate, endDate } = calculateDateRange(period));
  }

  console.log(`📅 Collecting achievements from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}\n`);

  // Validate environment variables
  const missingVars = [];
  if (!process.env.GITHUB_TOKEN) missingVars.push('GITHUB_TOKEN');
  if (!process.env.CLICKUP_TOKEN) missingVars.push('CLICKUP_TOKEN');
  if (!process.env.NOTION_TOKEN) missingVars.push('NOTION_TOKEN');

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars.join(', '));
    console.error('   Please create a .env file based on .env.example\n');
    process.exit(1);
  }

  // Initialize collectors
  const collectors = {
    github: new GitHubCollector(
      process.env.GITHUB_TOKEN,
      config.github.username,
      config.github
    ),
    clickup: new ClickUpCollector(
      process.env.CLICKUP_TOKEN,
      config.clickup
    ),
    notion: new NotionCollector(
      process.env.NOTION_TOKEN,
      config.notion
    ),
  };

  // Collect data from all sources
  const data = {};

  try {
    // Run collectors in parallel
    const [githubData, clickupData, notionData] = await Promise.all([
      collectors.github.collect(startDate, endDate),
      collectors.clickup.collect(startDate, endDate),
      collectors.notion.collect(startDate, endDate),
    ]);

    data.github = githubData;
    data.clickup = clickupData;
    data.notion = notionData;

    console.log('\n✅ Collection complete!\n');
  } catch (error) {
    console.error('❌ Error during collection:', error.message);
    process.exit(1);
  }

  // Format output
  console.log('📝 Generating markdown report...');
  const formatter = new MarkdownFormatter(config.output);
  const markdown = formatter.generate(data, startDate, endDate);

  // Ensure output directory exists
  const outputDir = config.output.directory;
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
  }

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `${config.output.filePattern}-${timestamp}.md`;
  const filepath = path.join(outputDir, filename);

  // Write to file
  await writeFile(filepath, markdown, 'utf8');

  console.log(`\n✅ Report saved to: ${filepath}`);
  console.log('\n📋 Next steps:');
  console.log('   1. Open the generated markdown file');
  console.log('   2. Copy the entire contents');
  console.log('   3. Paste into Claude.ai or ChatGPT');
  console.log('   4. Follow the instructions in the file to merge with your existing journal\n');
}

// Run main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
