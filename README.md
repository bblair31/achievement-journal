# Achievement Journal

Automated achievement journal that collects your professional activities from GitHub, ClickUp, and Notion, then formats them for easy processing with AI to maintain your career brag document.

## Why This Tool?

Keeping track of your professional achievements is crucial for:
- Performance reviews
- Resume updates
- Job interviews
- Promotion discussions
- Career reflection

But manually tracking everything you do is tedious and easy to forget. This tool automates the collection of your activities and prepares them for AI-assisted summarization.

## How It Works

1. **Collect**: Automatically gathers your activities from:
   - GitHub commits, PRs, and issues
   - ClickUp tasks and subtasks you've worked on
   - Notion pages you've created or edited

2. **Format**: Generates a structured markdown report with all your activities

3. **Summarize**: Copy the report into Claude.ai or ChatGPT to merge with your existing journal and create meaningful achievement summaries

4. **Automate**: Optionally runs monthly via GitHub Actions, so you never forget to update your journal

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Get API Tokens

#### GitHub Personal Access Token
1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scopes:
   - `repo` (for private repos)
   - or `public_repo` (for public repos only)
4. Copy the token (starts with `ghp_`)

#### ClickUp API Token
1. Go to https://app.clickup.com/settings/apps
2. Click "Apps" in the sidebar
3. Click "Generate" under API Token
4. Copy the token (starts with `pk_`)

#### Notion Integration Token
1. Go to https://www.notion.so/my-integrations
2. Click "+ New integration"
3. Give it a name (e.g., "Achievement Journal")
4. Copy the Internal Integration Token (starts with `secret_`)
5. **Important**: Share the pages/databases you want to track with this integration:
   - Open the page in Notion
   - Click "..." menu → "Add connections"
   - Select your integration

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` and add your tokens:

```env
GITHUB_TOKEN=ghp_your_token_here
GITHUB_USERNAME=bblair31
CLICKUP_TOKEN=pk_your_token_here
NOTION_TOKEN=secret_your_token_here
```

**IMPORTANT**: Never commit your `.env` file to Git. It's already in `.gitignore`.

### 4. Customize Configuration (Optional)

Edit `config.js` to customize:
- Specific repos to track (or leave empty for all)
- ClickUp workspaces/lists to include
- Notion pages/databases to track
- Output directory and filename pattern

### 5. Set Up GitHub Actions (Optional but Recommended)

To run automatically every month:

1. Add secrets to your GitHub repository:
   - Go to your repo → Settings → Secrets and variables → Actions
   - Add these secrets:
     - `GH_PAT`: Your GitHub Personal Access Token
     - `CLICKUP_TOKEN`: Your ClickUp API token
     - `NOTION_TOKEN`: Your Notion integration token

2. The workflow will:
   - Run monthly on the 1st at 9am UTC
   - Can be triggered manually from the Actions tab
   - Commit the generated report to the repo
   - Upload as an artifact you can download

## Usage

### Run Locally

Collect achievements for the last month:
```bash
npm run collect
# or
npm run collect:month
```

Collect for the last week:
```bash
npm run collect:week
```

Custom date range:
```bash
npm run collect -- --start-date 2025-01-01 --end-date 2025-01-31
```

Custom period:
```bash
npm run collect -- --period quarter
```

### Using the Generated Report

1. Open the generated markdown file in `output/achievements-YYYY-MM-DD.md`

2. Copy the entire contents

3. Open Claude.ai (recommended) or ChatGPT

4. Paste the report along with your existing journal

5. Use the suggested prompt in the report (or customize it):
   ```
   I have two documents:
   1. My existing achievement journal (paste below)
   2. Raw activity data from the past period (already pasted above)

   Please help me:
   - Review the raw activities and identify significant accomplishments
   - Group related activities into broader achievements
   - Merge these new achievements into my existing journal
   - Update any ongoing projects that have made progress
   - Maintain chronological order and consistent formatting
   ```

6. Review the AI's output and save your updated journal

### Manual GitHub Actions Trigger

1. Go to your repo → Actions tab
2. Select "Collect Achievements" workflow
3. Click "Run workflow"
4. Choose options:
   - Period: week, month, quarter, or year
   - Or specify custom start/end dates
5. Click "Run workflow"
6. Download the artifact or check the committed file

## Project Structure

```
achievement-journal/
├── src/
│   ├── collectors/
│   │   ├── github.js      # GitHub API integration
│   │   ├── clickup.js     # ClickUp API integration
│   │   └── notion.js      # Notion API integration
│   ├── formatter.js       # Markdown output generator
│   └── index.js           # Main CLI script
├── .github/
│   └── workflows/
│       └── collect-achievements.yml  # GitHub Actions workflow
├── output/                # Generated reports (gitignored)
├── config.js              # User configuration
├── .env                   # API tokens (gitignored)
├── .env.example           # Template for .env
└── package.json           # Dependencies and scripts
```

## Tips

### For Best Results

1. **Run regularly**: Monthly is a good cadence to keep your journal current

2. **Be specific in AI prompts**: Tell the AI what kind of language/tone you want (e.g., "results-oriented", "technical details", "impact-focused")

3. **Review AI output**: The AI is great at synthesizing, but you know your work best. Edit as needed.

4. **Keep your existing journal**: This tool adds to your journal, not replaces it

5. **Adjust collection period**: Use shorter periods (weekly) during busy times, longer (quarterly) during slower periods

### Reducing API Costs

Since this version uses manual AI processing:
- **Zero API costs** for the collection tool
- **Use your existing Claude.ai subscription** (or free ChatGPT)
- Only pay for what you already use

Future enhancement: Add optional API integration for fully automated summarization.

## Troubleshooting

### "Missing required environment variables"

Make sure your `.env` file exists and contains all three tokens.

### GitHub: "API error: 401"

Your `GITHUB_TOKEN` may be expired or invalid. Generate a new one.

### ClickUp: No tasks found

Make sure:
1. Your token is correct
2. You're assigned to tasks in the date range
3. Check `config.js` - you might have filtered to specific workspaces/lists

### Notion: No pages found

Make sure:
1. Your integration token is correct
2. You've **shared pages with your integration** (this is easy to forget!)
3. You have pages created/edited in the date range

### GitHub Actions not running

Check:
1. Secrets are added to your repo (Settings → Secrets and variables → Actions)
2. Secret names match exactly: `GH_PAT`, `CLICKUP_TOKEN`, `NOTION_TOKEN`
3. Workflow file is in `.github/workflows/`

## Future Enhancements

Potential additions (let me know if you want these!):

- [ ] Direct AI API integration for fully automated summarization
- [ ] Export to Word/PDF format
- [ ] Integration with Jira, Linear, or other project management tools
- [ ] Slack/Discord notifications when report is ready
- [ ] Email delivery of reports
- [ ] Web dashboard to browse historical achievements
- [ ] AI-powered tagging and categorization
- [ ] Resume builder integration

## Contributing

This is a personal tool, but feel free to fork and customize for your needs!

## License

ISC
