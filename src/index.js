#!/usr/bin/env node

/**
 * Achievement Journal CLI
 * Collects activities from GitHub, ClickUp, and Notion
 * Functional implementation
 */

import { config as loadEnv } from 'dotenv';
import { collectGitHubActivity } from './collectors/github.js';
import { collectClickUpActivity } from './collectors/clickup.js';
import { collectNotionActivity } from './collectors/notion.js';
import { generateMarkdown } from './formatter.js';
import config from '../config.js';
import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Load environment variables
loadEnv();

/**
 * Parse command line arguments
 */
const parseArgs = (args) => {
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
        return { showHelp: true };
    }
  }

  return options;
};

/**
 * Show help message
 */
const showHelp = () => {
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
};

/**
 * Calculate date range based on period
 */
const calculateDateRange = (period) => {
  const endDate = new Date();
  const startDate = new Date();

  const periodMap = {
    week: () => startDate.setDate(endDate.getDate() - 7),
    month: () => startDate.setMonth(endDate.getMonth() - 1),
    quarter: () => startDate.setMonth(endDate.getMonth() - 3),
    year: () => startDate.setFullYear(endDate.getFullYear() - 1),
  };

  const setPeriod = periodMap[period] || periodMap.month;
  setPeriod();

  return { startDate, endDate };
};

/**
 * Validate required environment variables
 */
const validateEnv = () => {
  const required = {
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    CLICKUP_TOKEN: process.env.CLICKUP_TOKEN,
    NOTION_TOKEN: process.env.NOTION_TOKEN,
  };

  const missing = Object.entries(required)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('   Please create a .env file based on .env.example\n');
    process.exit(1);
  }

  return required;
};

/**
 * Ensure output directory exists
 */
const ensureOutputDir = async (dir) => {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
};

/**
 * Generate output filename with timestamp
 */
const generateFilename = (pattern) => {
  const timestamp = new Date().toISOString().split('T')[0];
  return `${pattern}-${timestamp}.md`;
};

/**
 * Save markdown to file
 */
const saveMarkdown = async (outputDir, filename, markdown) => {
  await ensureOutputDir(outputDir);
  const filepath = path.join(outputDir, filename);
  await writeFile(filepath, markdown, 'utf8');
  return filepath;
};

/**
 * Collect data from all sources
 */
const collectAllData = async (env, startDate, endDate) => {
  console.log(`📅 Collecting achievements from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}\n`);

  const [githubData, clickupData, notionData] = await Promise.all([
    collectGitHubActivity(env.GITHUB_TOKEN, config.github.username, config.github, startDate, endDate),
    collectClickUpActivity(env.CLICKUP_TOKEN, config.clickup, startDate, endDate),
    collectNotionActivity(env.NOTION_TOKEN, config.notion, startDate, endDate),
  ]);

  return {
    github: githubData,
    clickup: clickupData,
    notion: notionData,
  };
};

/**
 * Main execution function
 */
const main = async () => {
  console.log('🎯 Achievement Journal Collector\n');

  // Parse arguments
  const options = parseArgs(process.argv.slice(2));

  if (options.showHelp) {
    showHelp();
    process.exit(0);
  }

  // Determine date range
  const { startDate, endDate } = options.startDate && options.endDate
    ? { startDate: options.startDate, endDate: options.endDate }
    : calculateDateRange(options.period || config.dateRange.defaultPeriod);

  // Validate environment
  const env = validateEnv();

  try {
    // Collect data from all sources
    const data = await collectAllData(env, startDate, endDate);

    console.log('\n✅ Collection complete!\n');

    // Generate markdown report
    console.log('📝 Generating markdown report...');
    const markdown = generateMarkdown(config.output, data, startDate, endDate);

    // Save to file
    const filename = generateFilename(config.output.filePattern);
    const filepath = await saveMarkdown(config.output.directory, filename, markdown);

    console.log(`\n✅ Report saved to: ${filepath}`);
    console.log('\n📋 Next steps:');
    console.log('   1. Open the generated markdown file');
    console.log('   2. Copy the entire contents');
    console.log('   3. Paste into Claude.ai or ChatGPT');
    console.log('   4. Follow the instructions in the file to merge with your existing journal\n');
  } catch (error) {
    console.error('❌ Error during collection:', error.message);
    process.exit(1);
  }
};

// Run main function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
