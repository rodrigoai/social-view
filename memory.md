# SocialView Memory File

## Application Overview
- **Name**: SocialView
- **Purpose**: A social dashboard to show important information about social networks, Google Ads, and Google Analytics.
- **Architecture**: NextJS (Frontend + Backend via API Routes) + TailwindCSS.
- **Database**: Prisma ORM with SQLite (MVP). Will use Vercel Postgres later.

## Key Instructions & Rules
- **Testing**: NEVER create a new feature without writing at least 3 unit tests.
- **Componentization**: Actively seek opportunities to componentize features (e.g., Navbar, FilterPanel) even if they vary slightly across areas.
- **Aesthetics**: Ensure a premium, modern design (vibrant colors, glassmorphism, animations) that WOWs the user.
- **No "Ghost" Data**: All data displayed must come from an API/Source. Do not fabricate metrics or stats.
- Never put API keys or passwords directly in the code
- Never commit
.env. local to GitHub
- Never expose Supabase service_role key in frontend
- Ask before deleting or renaming any important files
code
- Every final change in code, run npm run test to make sure everything works fine.

## Testing Architecture
- **Libraries**:
  - `prisma-mock` for database mocking.
  - `msw` (Mock Service Worker) for API mocking.
- **Mocking Strategy**:
  - Mock all external API calls using `msw`.
  - Mock the database using `prisma-mock`.
  - Use `jest.mock` to mock internal modules.
- **Running Tests**:
  - Run tests with `npm run test`.
  - Run tests in watch mode with `npm run test:watch`.

## State & Features
- **Authentication**: OAuth 2.0 for Google APIs and Meta Graph API.
- **Main Account**: The central entity that links to Google and Meta accounts. Configurable in settings.
- **Dashboard**: Displays campaigns, cost, and conversions. Switchable between Google Dashboard and Meta Dashboard views. Reuses `FilterPanel` for date and campaign filtering.

## Google Ads API Integration
- **Libraries**:
  - `google-ads-api` for data fetching.
  - `google-auth-library` for OAuth 2.0.
- **Refresh Token**: Use `client.credentials.refresh_token` to refresh tokens without user interaction.
- **Error Handling**: Catch specific Google Ads API errors (e.g., `Customer May Not Be Enabled`) and return appropriate responses.
- **Date Range**: Supports `LAST_7_DAYS`, `LAST_30_DAYS`, `90D`, and custom dates.

## Meta API Integration
- **Platform**: Meta Graph API & Marketing API for fetching Facebook Pages, Instagram, and Meta Ads.
- **Entities**: Supports connecting Meta Ads (Ad Accounts), Facebook Pages, and Instagram Pages.
- **Authentication**: Uses short-lived to long-lived token exchange for persistent access without user interaction.
- **Error Handling**: Monitor for OAuth token expiration and ad account permission errors.

