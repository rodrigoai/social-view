-- CreateTable
CREATE TABLE "MainAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'My Business',
    "googleBusinessUrl" TEXT,
    "mainWebsiteUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MainAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleCredential" (
    "id" TEXT NOT NULL,
    "mainAccountId" TEXT NOT NULL,
    "refreshToken" TEXT,
    "accessToken" TEXT,
    "expiresAt" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleAdsConfig" (
    "id" TEXT NOT NULL,
    "mainAccountId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleAdsConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleAnalyticsConfig" (
    "id" TEXT NOT NULL,
    "mainAccountId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "propertyName" TEXT,
    "trackedEventName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleAnalyticsConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleSearchConsoleConfig" (
    "id" TEXT NOT NULL,
    "mainAccountId" TEXT NOT NULL,
    "siteUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleSearchConsoleConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaCredential" (
    "id" TEXT NOT NULL,
    "mainAccountId" TEXT NOT NULL,
    "accessToken" TEXT,
    "longLivedToken" TEXT,
    "expiresAt" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaAdsConfig" (
    "id" TEXT NOT NULL,
    "mainAccountId" TEXT NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "adAccountName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaAdsConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacebookPageConfig" (
    "id" TEXT NOT NULL,
    "mainAccountId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "pageName" TEXT,
    "accessToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacebookPageConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstagramPageConfig" (
    "id" TEXT NOT NULL,
    "mainAccountId" TEXT NOT NULL,
    "igAccountId" TEXT NOT NULL,
    "igAccountName" TEXT,
    "facebookPageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstagramPageConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstagramFollowersHistory" (
    "id" TEXT NOT NULL,
    "igAccountId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "followersCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstagramFollowersHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleCredential_mainAccountId_key" ON "GoogleCredential"("mainAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleAdsConfig_mainAccountId_customerId_key" ON "GoogleAdsConfig"("mainAccountId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleAnalyticsConfig_mainAccountId_propertyId_key" ON "GoogleAnalyticsConfig"("mainAccountId", "propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleSearchConsoleConfig_mainAccountId_siteUrl_key" ON "GoogleSearchConsoleConfig"("mainAccountId", "siteUrl");

-- CreateIndex
CREATE UNIQUE INDEX "MetaCredential_mainAccountId_key" ON "MetaCredential"("mainAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaAdsConfig_mainAccountId_adAccountId_key" ON "MetaAdsConfig"("mainAccountId", "adAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "FacebookPageConfig_mainAccountId_pageId_key" ON "FacebookPageConfig"("mainAccountId", "pageId");

-- CreateIndex
CREATE UNIQUE INDEX "InstagramPageConfig_mainAccountId_igAccountId_key" ON "InstagramPageConfig"("mainAccountId", "igAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "InstagramFollowersHistory_igAccountId_date_key" ON "InstagramFollowersHistory"("igAccountId", "date");

-- CreateIndex
CREATE INDEX "InstagramFollowersHistory_igAccountId_date_idx" ON "InstagramFollowersHistory"("igAccountId", "date");

-- AddForeignKey
ALTER TABLE "GoogleCredential" ADD CONSTRAINT "GoogleCredential_mainAccountId_fkey" FOREIGN KEY ("mainAccountId") REFERENCES "MainAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleAdsConfig" ADD CONSTRAINT "GoogleAdsConfig_mainAccountId_fkey" FOREIGN KEY ("mainAccountId") REFERENCES "MainAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleAnalyticsConfig" ADD CONSTRAINT "GoogleAnalyticsConfig_mainAccountId_fkey" FOREIGN KEY ("mainAccountId") REFERENCES "MainAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleSearchConsoleConfig" ADD CONSTRAINT "GoogleSearchConsoleConfig_mainAccountId_fkey" FOREIGN KEY ("mainAccountId") REFERENCES "MainAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaCredential" ADD CONSTRAINT "MetaCredential_mainAccountId_fkey" FOREIGN KEY ("mainAccountId") REFERENCES "MainAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaAdsConfig" ADD CONSTRAINT "MetaAdsConfig_mainAccountId_fkey" FOREIGN KEY ("mainAccountId") REFERENCES "MainAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacebookPageConfig" ADD CONSTRAINT "FacebookPageConfig_mainAccountId_fkey" FOREIGN KEY ("mainAccountId") REFERENCES "MainAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstagramPageConfig" ADD CONSTRAINT "InstagramPageConfig_mainAccountId_fkey" FOREIGN KEY ("mainAccountId") REFERENCES "MainAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
