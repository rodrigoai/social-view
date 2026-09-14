import { NextResponse } from 'next/server';
import { authzErrorResponse, requireMainAccountAccess } from '@/lib/authz';
import { CoyoTasksError, fetchCoyoTasksForAccount } from '@/lib/coyoTasksServer';
import { extractGoogleDriveFileId } from '@/lib/coyoTasks';
import { getConfiguredGoogleDriveClient } from '@/lib/googleDriveServiceAccount';

const GOOGLE_EXPORTS: Record<string, { mimeType: string; extension: string }> = {
  'application/vnd.google-apps.document': { mimeType: 'application/pdf', extension: '.pdf' },
  'application/vnd.google-apps.spreadsheet': { mimeType: 'application/pdf', extension: '.pdf' },
  'application/vnd.google-apps.presentation': { mimeType: 'application/pdf', extension: '.pdf' },
  'application/vnd.google-apps.drawing': { mimeType: 'application/pdf', extension: '.pdf' },
};
const MAX_PREVIEW_BYTES = 25 * 1024 * 1024;
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

function previewHeaders(fileName: string, mimeType: string) {
  const safeName = fileName.replace(/[\r\n"]/g, '_');
  return {
    'Content-Type': mimeType,
    'Content-Disposition': `inline; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "sandbox; default-src 'none'",
  };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const mainAccountId = params.get('mainAccountId');
  const taskId = params.get('taskId');
  const requestedFileId = params.get('fileId');
  if (!mainAccountId || !taskId) return NextResponse.json({ error: 'Missing task or account.' }, { status: 400 });
  if (requestedFileId && !/^[A-Za-z0-9_-]{1,200}$/.test(requestedFileId)) return NextResponse.json({ error: 'Invalid Drive file.' }, { status: 400 });

  try {
    await requireMainAccountAccess(mainAccountId);
    const tasks = await fetchCoyoTasksForAccount(mainAccountId);
    const task = tasks.find(item => item.id === taskId);
    if (!task) return NextResponse.json({ error: 'Attachment not found for this account.' }, { status: 404 });
    const rootFileId = task.driveLink ? extractGoogleDriveFileId(task.driveLink) : null;
    if (!rootFileId) return NextResponse.json({ error: 'This item does not contain a supported Google Drive link.' }, { status: 404 });

    const drive = await getConfiguredGoogleDriveClient();
    const rootResponse = await drive.files.get({ fileId: rootFileId, fields: 'id,mimeType,trashed', supportsAllDrives: true });
    if (rootResponse.data.trashed) return NextResponse.json({ error: 'This Google Drive item is in the trash.' }, { status: 404 });
    const rootIsFolder = rootResponse.data.mimeType === FOLDER_MIME_TYPE;
    if (rootIsFolder && !requestedFileId) return NextResponse.json({ error: 'Select a file from this Drive folder.' }, { status: 400 });
    if (!rootIsFolder && requestedFileId && requestedFileId !== rootFileId) return NextResponse.json({ error: 'This file is outside the linked Drive item.' }, { status: 403 });
    const fileId = requestedFileId || rootFileId;
    if (rootIsFolder) {
      const childResponse = await drive.files.get({ fileId, fields: 'id,parents,trashed', supportsAllDrives: true });
      if (childResponse.data.trashed || !childResponse.data.parents?.includes(rootFileId)) return NextResponse.json({ error: 'This file is outside the linked Drive folder.' }, { status: 403 });
    }
    const metadataResponse = await drive.files.get({ fileId, fields: 'id,name,mimeType,size,trashed,capabilities(canDownload)', supportsAllDrives: true });
    const metadata = metadataResponse.data;
    if (metadata.trashed || metadata.capabilities?.canDownload === false) return NextResponse.json({ error: 'This Google Drive file cannot be previewed.' }, { status: 403 });
    const size = Number(metadata.size || 0);
    if (size > MAX_PREVIEW_BYTES) return NextResponse.json({ error: 'This file is too large to preview in SocialView.' }, { status: 413 });

    const fileName = metadata.name || 'attachment';
    const mimeType = metadata.mimeType || 'application/octet-stream';
    const exportConfig = GOOGLE_EXPORTS[mimeType];
    if (exportConfig) {
      const response = await drive.files.export({ fileId, mimeType: exportConfig.mimeType }, { responseType: 'arraybuffer' });
      return new Response(Buffer.from(response.data as ArrayBuffer), { headers: previewHeaders(fileName.endsWith(exportConfig.extension) ? fileName : `${fileName}${exportConfig.extension}`, exportConfig.mimeType) });
    }
    if (mimeType.startsWith('application/vnd.google-apps.')) return NextResponse.json({ error: 'This Google Workspace file type cannot be previewed.' }, { status: 415 });
    const response = await drive.files.get({ fileId, alt: 'media', supportsAllDrives: true }, { responseType: 'arraybuffer' });
    return new Response(Buffer.from(response.data as ArrayBuffer), { headers: previewHeaders(fileName, mimeType) });
  } catch (error) {
    const authResponse = authzErrorResponse(error);
    if (authResponse) return authResponse;
    if (error instanceof CoyoTasksError) return NextResponse.json({ error: error.message }, { status: error.status });
    const code = error instanceof Error ? error.message : '';
    if (code === 'GOOGLE_DRIVE_NOT_CONFIGURED') return NextResponse.json({ error: 'Configure the global Google Drive service account in Settings.' }, { status: 503 });
    if (code === 'APP_CONFIG_ENCRYPTION_KEY_MISSING' || code === 'INVALID_ENCRYPTED_SECRET') return NextResponse.json({ error: 'The Google Drive configuration cannot be decrypted. Contact an administrator.' }, { status: 503 });
    const status = (error as { code?: number; status?: number })?.code || (error as { status?: number })?.status;
    if (status === 403 || status === 404) return NextResponse.json({ error: 'Share this file or its parent folder with the configured service account.' }, { status: 403 });
    return NextResponse.json({ error: 'Unable to load this Google Drive attachment.' }, { status: 502 });
  }
}
