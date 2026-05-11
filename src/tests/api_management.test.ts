/**
 * @jest-environment node
 */
import { GET, POST } from '../app/api/accounts/route';
import { PATCH, DELETE as DELETE_ACCOUNT } from '../app/api/accounts/[id]/route';

import { prisma } from '../lib/prisma';
import { NextResponse } from 'next/server';

// Mock NextResponse
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data, init) => ({
      json: async () => data,
      status: init?.status || 200,
      ok: (init?.status || 200) < 400
    }))
  }
}));

// Mock prisma
jest.mock('../lib/prisma', () => ({
  prisma: {
    mainAccount: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    }
  }
}));

describe('Account Management API', () => {
  let testAccountId = 'test-id';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update account name via PATCH', async () => {
    const request = new Request('http://localhost/api/accounts/' + testAccountId, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated Name' })
    });

    (prisma.mainAccount.update as jest.Mock).mockResolvedValue({ id: testAccountId, name: 'Updated Name' });
    (prisma.mainAccount.findUnique as jest.Mock).mockResolvedValue({ id: testAccountId, name: 'Updated Name' });

    const response = await PATCH(request, { params: Promise.resolve({ id: testAccountId }) });
    const data = await response.json();

    expect(data.account.name).toBe('Updated Name');
    expect(prisma.mainAccount.update).toHaveBeenCalledWith({
      where: { id: testAccountId },
      data: { name: 'Updated Name' }
    });
  });

  it('should save a googleBusinessUrl via PATCH', async () => {
    const url = 'https://business.google.com/n/12345';
    const request = new Request('http://localhost/api/accounts/' + testAccountId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ googleBusinessUrl: url })
    });

    (prisma.mainAccount.update as jest.Mock).mockResolvedValue({ id: testAccountId, googleBusinessUrl: url });

    const response = await PATCH(request, { params: Promise.resolve({ id: testAccountId }) });
    const data = await response.json();

    expect(data.account.googleBusinessUrl).toBe(url);
    expect(prisma.mainAccount.update).toHaveBeenCalledWith({
      where: { id: testAccountId },
      data: { googleBusinessUrl: url }
    });
  });

  it('should clear googleBusinessUrl when null is passed', async () => {
    const request = new Request('http://localhost/api/accounts/' + testAccountId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ googleBusinessUrl: null })
    });

    (prisma.mainAccount.update as jest.Mock).mockResolvedValue({ id: testAccountId, googleBusinessUrl: null });

    const response = await PATCH(request, { params: Promise.resolve({ id: testAccountId }) });
    const data = await response.json();

    expect(data.account.googleBusinessUrl).toBeNull();
    expect(prisma.mainAccount.update).toHaveBeenCalledWith({
      where: { id: testAccountId },
      data: { googleBusinessUrl: null }
    });
  });

  it('should clear googleBusinessUrl when empty string is passed', async () => {
    (prisma.mainAccount.update as jest.Mock).mockResolvedValue({ id: testAccountId, googleBusinessUrl: null });

    const request = new Request('http://localhost/api/accounts/' + testAccountId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ googleBusinessUrl: '' })
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: testAccountId }) });
    const data = await response.json();
    expect(data.account.googleBusinessUrl).toBeNull();
    expect(prisma.mainAccount.update).toHaveBeenCalledWith({
      where: { id: testAccountId },
      data: { googleBusinessUrl: null }
    });
  });

  it('should save a mainWebsiteUrl via PATCH', async () => {
    const url = 'https://example.com';
    const request = new Request('http://localhost/api/accounts/' + testAccountId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mainWebsiteUrl: url })
    });

    (prisma.mainAccount.update as jest.Mock).mockResolvedValue({ id: testAccountId, mainWebsiteUrl: url });

    const response = await PATCH(request, { params: Promise.resolve({ id: testAccountId }) });
    const data = await response.json();

    expect(data.account.mainWebsiteUrl).toBe(url);
    expect(prisma.mainAccount.update).toHaveBeenCalledWith({
      where: { id: testAccountId },
      data: { mainWebsiteUrl: url }
    });
  });

  it('should delete account via DELETE', async () => {
    const request = new Request('http://localhost/api/accounts/' + testAccountId, {
      method: 'DELETE'
    });

    (prisma.mainAccount.delete as jest.Mock).mockResolvedValue({ id: testAccountId });

    const response = await DELETE_ACCOUNT(request, { params: Promise.resolve({ id: testAccountId }) });
    expect(response.status).toBe(200);

    expect(prisma.mainAccount.delete).toHaveBeenCalledWith({ where: { id: testAccountId } });
  });
});
