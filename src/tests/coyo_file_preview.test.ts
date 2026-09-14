/** @jest-environment node */
import { GET } from '@/app/api/coyo/files/preview/route';
import { requireMainAccountAccess, authzErrorResponse } from '@/lib/authz';
import { fetchCoyoTasksForAccount } from '@/lib/coyoTasksServer';
import { getConfiguredGoogleDriveClient } from '@/lib/googleDriveServiceAccount';

jest.mock('@/lib/authz', () => ({ requireMainAccountAccess: jest.fn(), authzErrorResponse: jest.fn(() => null) }));
jest.mock('@/lib/coyoTasksServer', () => ({ CoyoTasksError: class CoyoTasksError extends Error { status: number; constructor(message: string, status: number) { super(message); this.status = status; } }, fetchCoyoTasksForAccount: jest.fn() }));
jest.mock('@/lib/googleDriveServiceAccount', () => ({ getConfiguredGoogleDriveClient: jest.fn() }));

const request = (fileId?: string) => new Request(`http://localhost/api/coyo/files/preview?mainAccountId=account-1&taskId=task-1${fileId ? `&fileId=${fileId}` : ''}`);
const task = { id: 'task-1', description: '<a href="/api/drive/media?fileId=wrong_file">old brief</a>', driveLink: '/api/drive/media?fileId=file_123' };

describe('Coyô Google Drive preview proxy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireMainAccountAccess as jest.Mock).mockResolvedValue({});
    (fetchCoyoTasksForAccount as jest.Mock).mockResolvedValue([task]);
  });

  it('validates account task ownership before downloading a blob file', async () => {
    const get = jest.fn()
      .mockResolvedValueOnce({ data: { mimeType: 'application/pdf', trashed: false } })
      .mockResolvedValueOnce({ data: { name: 'brief.pdf', mimeType: 'application/pdf', size: '3', capabilities: { canDownload: true } } })
      .mockResolvedValueOnce({ data: new Uint8Array([1, 2, 3]) });
    (getConfiguredGoogleDriveClient as jest.Mock).mockResolvedValue({ files: { get, export: jest.fn() } });
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(get).toHaveBeenNthCalledWith(3, { fileId: 'file_123', alt: 'media', supportsAllDrives: true }, { responseType: 'arraybuffer' });
  });

  it('exports native Google Workspace documents as PDF', async () => {
    const get = jest.fn().mockResolvedValue({ data: { name: 'Plan', mimeType: 'application/vnd.google-apps.document', capabilities: { canDownload: true } } });
    const exportFile = jest.fn().mockResolvedValue({ data: new Uint8Array([4, 5]) });
    (getConfiguredGoogleDriveClient as jest.Mock).mockResolvedValue({ files: { get, export: exportFile } });
    const response = await GET(request());
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toContain('Plan.pdf');
    expect(exportFile).toHaveBeenCalledWith({ fileId: 'file_123', mimeType: 'application/pdf' }, { responseType: 'arraybuffer' });
  });

  it('allows previews only for direct children of the linked folder', async () => {
    const get = jest.fn()
      .mockResolvedValueOnce({ data: { mimeType: 'application/vnd.google-apps.folder', trashed: false } })
      .mockResolvedValueOnce({ data: { parents: ['file_123'], trashed: false } })
      .mockResolvedValueOnce({ data: { name: 'post.jpg', mimeType: 'image/jpeg', size: '3', capabilities: { canDownload: true } } })
      .mockResolvedValueOnce({ data: new Uint8Array([7, 8, 9]) });
    (getConfiguredGoogleDriveClient as jest.Mock).mockResolvedValue({ files: { get, export: jest.fn() } });
    expect((await GET(request('child_1'))).status).toBe(200);
    expect(get).toHaveBeenNthCalledWith(2, { fileId: 'child_1', fields: 'id,parents,trashed', supportsAllDrives: true });
  });

  it('ignores attachment links found only in the description', async () => {
    (fetchCoyoTasksForAccount as jest.Mock).mockResolvedValue([{ ...task, driveLink: null }]);
    const response = await GET(request());
    expect(response.status).toBe(404);
    expect(getConfiguredGoogleDriveClient).not.toHaveBeenCalled();
  });

  it('never accesses Drive when the task is outside the selected account', async () => {
    (fetchCoyoTasksForAccount as jest.Mock).mockResolvedValue([]);
    const response = await GET(request());
    expect(response.status).toBe(404);
    expect(getConfiguredGoogleDriveClient).not.toHaveBeenCalled();
  });

  it('stops before Coyô lookup when account access is rejected', async () => {
    const forbidden = new Error('Forbidden');
    (requireMainAccountAccess as jest.Mock).mockRejectedValue(forbidden);
    (authzErrorResponse as jest.Mock).mockImplementation(error => error === forbidden ? Response.json({ error: 'Forbidden' }, { status: 403 }) : null);
    expect((await GET(request())).status).toBe(403);
    expect(fetchCoyoTasksForAccount).not.toHaveBeenCalled();
  });
});
