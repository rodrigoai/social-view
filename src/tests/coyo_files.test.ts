/** @jest-environment node */
import { GET } from '@/app/api/coyo/files/route';
import { requireMainAccountAccess, authzErrorResponse } from '@/lib/authz';
import { fetchCoyoTasksForAccount } from '@/lib/coyoTasksServer';
import { getConfiguredGoogleDriveClient } from '@/lib/googleDriveServiceAccount';

jest.mock('@/lib/authz', () => ({ requireMainAccountAccess: jest.fn(), authzErrorResponse: jest.fn(() => null) }));
jest.mock('@/lib/coyoTasksServer', () => ({ CoyoTasksError: class CoyoTasksError extends Error { status: number; constructor(message: string, status: number) { super(message); this.status = status; } }, fetchCoyoTasksForAccount: jest.fn() }));
jest.mock('@/lib/googleDriveServiceAccount', () => ({ getConfiguredGoogleDriveClient: jest.fn() }));

const request = new Request('http://localhost/api/coyo/files?mainAccountId=account-1&taskId=task-1');

describe('Coyô Google Drive manifest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireMainAccountAccess as jest.Mock).mockResolvedValue({});
    (authzErrorResponse as jest.Mock).mockReturnValue(null);
    (fetchCoyoTasksForAccount as jest.Mock).mockResolvedValue([{ id: 'task-1', description: '<a href="/api/drive/media?fileId=wrong">wrong</a>', driveLink: 'https://drive.google.com/drive/folders/folder_1' }]);
  });

  it('lists non-folder children when driveLink points to a folder', async () => {
    const list = jest.fn().mockResolvedValue({ data: { files: [
      { id: 'image_1', name: '01.jpg', mimeType: 'image/jpeg' },
      { id: 'video_1', name: '02.mp4', mimeType: 'video/mp4' },
    ] } });
    const get = jest.fn().mockResolvedValue({ data: { name: 'Campaign', mimeType: 'application/vnd.google-apps.folder', trashed: false } });
    (getConfiguredGoogleDriveClient as jest.Mock).mockResolvedValue({ files: { get, list } });

    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ isFolder: true, name: 'Campaign', files: [
      { id: 'image_1', name: '01.jpg', mimeType: 'image/jpeg' },
      { id: 'video_1', name: '02.mp4', mimeType: 'video/mp4' },
    ] });
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ q: expect.stringContaining("'folder_1' in parents"), orderBy: 'name_natural' }));
  });

  it('returns one item when driveLink points directly to a file', async () => {
    (fetchCoyoTasksForAccount as jest.Mock).mockResolvedValue([{ id: 'task-1', driveLink: 'https://drive.google.com/file/d/file_1/view' }]);
    const list = jest.fn();
    const get = jest.fn().mockResolvedValue({ data: { name: 'Artwork.png', mimeType: 'image/png', trashed: false } });
    (getConfiguredGoogleDriveClient as jest.Mock).mockResolvedValue({ files: { get, list } });

    expect(await (await GET(request)).json()).toEqual({ isFolder: false, name: 'Artwork.png', files: [{ id: 'file_1', name: 'Artwork.png', mimeType: 'image/png' }] });
    expect(list).not.toHaveBeenCalled();
  });
});
