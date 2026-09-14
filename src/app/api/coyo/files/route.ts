import { NextResponse } from 'next/server';
import { authzErrorResponse, requireMainAccountAccess } from '@/lib/authz';
import { CoyoTasksError, fetchCoyoTasksForAccount } from '@/lib/coyoTasksServer';
import { extractGoogleDriveFileId } from '@/lib/coyoTasks';
import { getConfiguredGoogleDriveClient } from '@/lib/googleDriveServiceAccount';

const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const mainAccountId = params.get('mainAccountId');
  const taskId = params.get('taskId');
  if (!mainAccountId || !taskId) return NextResponse.json({ error: 'Missing task or account.' }, { status: 400 });

  try {
    await requireMainAccountAccess(mainAccountId);
    const tasks = await fetchCoyoTasksForAccount(mainAccountId);
    const task = tasks.find(item => item.id === taskId);
    const rootFileId = task?.driveLink ? extractGoogleDriveFileId(task.driveLink) : null;
    if (!task || !rootFileId) return NextResponse.json({ error: 'This item does not contain a supported Google Drive link.' }, { status: 404 });

    const drive = await getConfiguredGoogleDriveClient();
    const rootResponse = await drive.files.get({ fileId: rootFileId, fields: 'id,name,mimeType,trashed', supportsAllDrives: true });
    const root = rootResponse.data;
    if (root.trashed) return NextResponse.json({ error: 'This Google Drive item is in the trash.' }, { status: 404 });

    if (root.mimeType !== FOLDER_MIME_TYPE) {
      return NextResponse.json({ isFolder: false, name: root.name || 'Drive file', files: [{ id: rootFileId, name: root.name || 'Drive file', mimeType: root.mimeType || 'application/octet-stream' }] });
    }

    const folderResponse = await drive.files.list({
      q: `'${rootFileId}' in parents and trashed = false and mimeType != '${FOLDER_MIME_TYPE}'`,
      fields: 'files(id,name,mimeType)',
      orderBy: 'name_natural',
      pageSize: 100,
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const files = (folderResponse.data.files || []).flatMap(file => file.id ? [{ id: file.id, name: file.name || 'Drive file', mimeType: file.mimeType || 'application/octet-stream' }] : []);
    return NextResponse.json({ isFolder: true, name: root.name || 'Drive folder', files });
  } catch (error) {
    const authResponse = authzErrorResponse(error);
    if (authResponse) return authResponse;
    if (error instanceof CoyoTasksError) return NextResponse.json({ error: error.message }, { status: error.status });
    const code = error instanceof Error ? error.message : '';
    if (code === 'GOOGLE_DRIVE_NOT_CONFIGURED') return NextResponse.json({ error: 'Configure the global Google Drive service account in Settings.' }, { status: 503 });
    if (code === 'APP_CONFIG_ENCRYPTION_KEY_MISSING' || code === 'INVALID_ENCRYPTED_SECRET') return NextResponse.json({ error: 'The Google Drive configuration cannot be decrypted. Contact an administrator.' }, { status: 503 });
    const status = (error as { code?: number; status?: number })?.code || (error as { status?: number })?.status;
    if (status === 403 || status === 404) return NextResponse.json({ error: 'Share this file or its parent folder with the configured service account.' }, { status: 403 });
    return NextResponse.json({ error: 'Unable to load this Google Drive link.' }, { status: 502 });
  }
}
