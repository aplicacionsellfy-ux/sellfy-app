
import { useState, useEffect } from 'react';
import { useToast } from '../components/ui/Toast';

export function usePersistedState<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const { addToast } = useToast();

  const setPersistedState = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(state) : value;
      setState(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error: any) {
      console.error(`Error saving localStorage key "${key}":`, error);
      
      // Manejo específico para cuando el localStorage está lleno (común con imágenes base64)
      if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        addToast("Memoria llena: No se pudo guardar el historial. Intenta borrar campañas antiguas.", "error");
      }
    }
  };

  return [state, setPersistedState];
}
