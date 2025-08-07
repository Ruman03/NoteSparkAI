// src/contexts/LoadingContext.tsx
// OPTIMIZED: Centralized Loading State Management

import React, { createContext, useContext, useReducer, ReactNode } from 'react';

interface LoadingState {
  global: boolean;
  notes: boolean;
  folders: boolean;
  ai: boolean;
  save: boolean;
  [key: string]: boolean;
}

type LoadingAction = 
  | { type: 'SET_LOADING'; key: keyof LoadingState; value: boolean }
  | { type: 'SET_GLOBAL_LOADING'; value: boolean }
  | { type: 'RESET_ALL_LOADING' };

interface LoadingContextType {
  loading: LoadingState;
  setLoading: (key: keyof LoadingState, value: boolean) => void;
  setGlobalLoading: (value: boolean) => void;
  resetAllLoading: () => void;
  isAnyLoading: () => boolean;
}

const initialLoadingState: LoadingState = {
  global: false,
  notes: false,
  folders: false,
  ai: false,
  save: false,
};

function loadingReducer(state: LoadingState, action: LoadingAction): LoadingState {
  switch (action.type) {
    case 'SET_LOADING':
      return {
        ...state,
        [action.key]: action.value,
      };
    case 'SET_GLOBAL_LOADING':
      return {
        ...state,
        global: action.value,
      };
    case 'RESET_ALL_LOADING':
      return initialLoadingState;
    default:
      return state;
  }
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const LoadingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [loading, dispatch] = useReducer(loadingReducer, initialLoadingState);

  const setLoading = (key: keyof LoadingState, value: boolean) => {
    dispatch({ type: 'SET_LOADING', key, value });
  };

  const setGlobalLoading = (value: boolean) => {
    dispatch({ type: 'SET_GLOBAL_LOADING', value });
  };

  const resetAllLoading = () => {
    dispatch({ type: 'RESET_ALL_LOADING' });
  };

  const isAnyLoading = () => {
    return Object.values(loading).some(value => value === true);
  };

  const value: LoadingContextType = {
    loading,
    setLoading,
    setGlobalLoading,
    resetAllLoading,
    isAnyLoading,
  };

  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  );
};

export const useLoading = (): LoadingContextType => {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};

// Helper hook for specific loading states
export const useSpecificLoading = (key: keyof LoadingState) => {
  const { loading, setLoading } = useLoading();
  
  return {
    isLoading: loading[key],
    setLoading: (value: boolean) => setLoading(key, value),
  };
};
