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

## State & Features
- **Authentication**: Implementing OAuth 2.0 for Google Ads API.
- **Main Account**: The central entity that links to Google Ads and Analytics accounts. Configurable in settings.
- **Dashboard**: Displays campaigns, cost, and total conversion. Includes filters by period and campaign.
