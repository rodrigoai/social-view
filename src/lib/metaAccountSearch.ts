export type SearchableMetaAccount = {
  id: string;
  name: string;
  actId?: string;
  facebookPageId?: string;
};

export function filterMetaAccounts<T extends SearchableMetaAccount>(accounts: T[], query: string): T[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return accounts;

  return accounts.filter((account) => [
    account.name,
    account.id,
    account.actId,
    account.facebookPageId,
  ].some((value) => String(value || '').toLocaleLowerCase().includes(normalizedQuery)));
}

