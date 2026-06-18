'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Account {
  id: string;
  name: string;
  googleBusinessUrl?: string | null;
  mainWebsiteUrl?: string | null;
  waTrackerAccountId?: string | null;
  googleCredential?: any;
  googleAdsConfigs?: any[];
  googleAnalyticsConfigs?: any[];
  googleSearchConsoleConfigs?: any[];
  metaCredential?: any;
  metaAdsConfigs?: any[];
  facebookPageConfigs?: any[];
  instagramPageConfigs?: any[];
}

interface AccountContextType {
  accounts: Account[];
  selectedAccountId: string | null;
  selectedAccount: Account | null;
  setSelectedAccountId: (id: string | null) => void;
  isLoading: boolean;
  refreshAccounts: () => Promise<void>;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAccounts = React.useCallback(async () => {
    try {
      const res = await fetch('/api/accounts');
      if (!res.ok) {
        setAccounts([]);
        setSelectedAccountIdState(null);
        localStorage.removeItem('selectedAccountId');
        return;
      }
      const data = await res.json();
      const fetchedAccounts = data.accounts || [];
      setAccounts(fetchedAccounts);
      
      // If no account is selected, or selected account doesn't exist anymore, pick the first one
      const savedId = localStorage.getItem('selectedAccountId');
      if (fetchedAccounts.length > 0) {
        if (!savedId || !fetchedAccounts.find((a: Account) => a.id === savedId)) {
          const firstId = fetchedAccounts[0].id;
          setSelectedAccountIdState(firstId);
          localStorage.setItem('selectedAccountId', firstId);
        } else {
          setSelectedAccountIdState(savedId);
        }
      } else {
        setSelectedAccountIdState(null);
        localStorage.removeItem('selectedAccountId');
      }
    } catch (error) {
      console.error('Failed to fetch accounts in context:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);


  useEffect(() => {
    fetchAccounts();
  }, []);

  const setSelectedAccountId = (id: string | null) => {
    setSelectedAccountIdState(id);
    if (id) {
      localStorage.setItem('selectedAccountId', id);
    } else {
      localStorage.removeItem('selectedAccountId');
    }
  };

  const selectedAccount = accounts.find(a => a.id === selectedAccountId) || null;

  return (
    <AccountContext.Provider value={{ 
      accounts, 
      selectedAccountId, 
      selectedAccount,
      setSelectedAccountId, 
      isLoading,
      refreshAccounts: fetchAccounts
    }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (context === undefined) {
    throw new Error('useAccount must be used within an AccountProvider');
  }
  return context;
}
