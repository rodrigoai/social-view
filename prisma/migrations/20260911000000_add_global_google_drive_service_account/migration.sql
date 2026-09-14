CREATE TABLE "AppConfiguration" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "googleDriveCredentialsEncrypted" TEXT,
    "googleDriveClientEmail" TEXT,
    "googleDriveProjectId" TEXT,
    "googleDrivePrivateKeyId" TEXT,
    "googleDriveUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppConfiguration_pkey" PRIMARY KEY ("id")
);
