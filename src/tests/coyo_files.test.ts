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
    expect(await response.json()).toEqual({ isFolder: true, name: 'Campaign', driveUrl: 'https://drive.google.com/drive/folders/folder_1', files: [
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

    expect(await (await GET(request)).json()).toEqual({ isFolder: false, name: 'Artwork.png', driveUrl: 'https://drive.google.com/file/d/file_1/view', files: [{ id: 'file_1', name: 'Artwork.png', mimeType: 'image/png' }] });
    expect(list).not.toHaveBeenCalled();
  });

  it('lists attachments embedded by Coyô in a Backlog description', async () => {
    (fetchCoyoTasksForAccount as jest.Mock).mockResolvedValue([{ id: 'task-1', status: 'BACKLOG', driveLink: null, description: '<img src="/api/drive/media?fileId=image_1"><a href="/api/drive/media?fileId=brief_2">Brief</a>' }]);
    const get = jest.fn()
      .mockResolvedValueOnce({ data: { name: 'Artwork.png', mimeType: 'image/png', parents: ['task_folder'], trashed: false } })
      .mockResolvedValueOnce({ data: { name: 'Brief.pdf', mimeType: 'application/pdf', parents: ['task_folder'], trashed: false } });
    (getConfiguredGoogleDriveClient as jest.Mock).mockResolvedValue({ files: { get, list: jest.fn() } });

    expect(await (await GET(request)).json()).toEqual({ isFolder: false, name: 'Backlog attachments', driveUrl: 'https://drive.google.com/drive/folders/task_folder', files: [
      { id: 'image_1', name: 'Artwork.png', mimeType: 'image/png' },
      { id: 'brief_2', name: 'Brief.pdf', mimeType: 'application/pdf' },
    ] });
  });

  it('groups multiple post formats from named subfolders and keeps natural filename order', async () => {
    (fetchCoyoTasksForAccount as jest.Mock).mockResolvedValue([{ id: 'task-1', category: 'POST', postFormat: ['Post', 'Story', 'Reels', 'Carousel'], driveLink: 'https://drive.google.com/drive/folders/folder_1' }]);
    const list = jest.fn().mockImplementation(({ q }: { q: string }) => {
      if (q.includes("'story_folder' in parents")) return Promise.resolve({ data: { files: [
        { id: 'story_10', name: 'story 10.jpg', mimeType: 'image/jpeg' },
        { id: 'story_2', name: 'STORY 2.mp4', mimeType: 'video/mp4' },
      ] } });
      if (q.includes("'carousel_folder' in parents")) return Promise.resolve({ data: { files: [
        { id: 'slide_10', name: '10.jpg', mimeType: 'image/jpeg' },
        { id: 'slide_2', name: '2.jpg', mimeType: 'image/jpeg' },
      ] } });
      if (q.includes("'reels_folder' in parents")) return Promise.resolve({ data: { files: [
        { id: 'reel_cover', name: 'cover.jpg', mimeType: 'image/jpeg' },
        { id: 'unprefixed_video', name: 'launch.mp4', mimeType: 'video/mp4' },
        { id: 'post_video', name: 'post-video.mp4', mimeType: 'video/mp4' },
        { id: 'story_video', name: 'STORY-video.mp4', mimeType: 'video/mp4' },
        { id: 'video_1', name: 'Video-launch.mp4', mimeType: 'video/mp4' },
        { id: 'reel_1', name: 'reel-launch.mp4', mimeType: 'video/mp4' },
        { id: 'reels_1', name: 'REELS-launch.mp4', mimeType: 'video/mp4' },
      ] } });
      return Promise.resolve({ data: { files: [
        { id: 'story_folder', name: 'sToRy', mimeType: 'application/vnd.google-apps.folder' },
        { id: 'carousel_folder', name: 'Carousel', mimeType: 'application/vnd.google-apps.folder' },
        { id: 'reels_folder', name: 'Reels', mimeType: 'application/vnd.google-apps.folder' },
        { id: 'post_1', name: 'cover.jpg', mimeType: 'image/jpeg' },
      ] } });
    });
    const get = jest.fn().mockResolvedValue({ data: { name: 'Campaign', mimeType: 'application/vnd.google-apps.folder', trashed: false } });
    (getConfiguredGoogleDriveClient as jest.Mock).mockResolvedValue({ files: { get, list } });

    const body = await (await GET(request)).json();
    expect(body.formats).toEqual([
      { format: 'Post', files: [{ id: 'post_1', name: 'cover.jpg', mimeType: 'image/jpeg' }] },
      { format: 'Story', files: [{ id: 'story_2', name: 'STORY 2.mp4', mimeType: 'video/mp4' }, { id: 'story_10', name: 'story 10.jpg', mimeType: 'image/jpeg' }] },
      { format: 'Reels', files: [
        { id: 'reel_1', name: 'reel-launch.mp4', mimeType: 'video/mp4' },
        { id: 'reels_1', name: 'REELS-launch.mp4', mimeType: 'video/mp4' },
        { id: 'video_1', name: 'Video-launch.mp4', mimeType: 'video/mp4' },
      ] },
      { format: 'Carousel', files: [{ id: 'slide_2', name: '2.jpg', mimeType: 'image/jpeg' }, { id: 'slide_10', name: '10.jpg', mimeType: 'image/jpeg' }] },
    ]);
  });
});
