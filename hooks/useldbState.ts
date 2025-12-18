import { useState, useEffect } from 'react';
import { get, set } from 'idb-keyval';
import { useToast } from '../components/ui/Toast';

export function useIdbState<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [state, setState] = useState<T>(initialValue);
  const { addToast } = useToast();

  useEffect(() => {
    let mounted = true;
    get(key).then((val) => {
      if (mounted && val !== undefined) {
        setState(val as T);
      }
    }).catch(err => {
      console.error('IDB Get Error', err);
    });
    
    return () => { mounted = false; };
  }, [key]);

  const setPersistedState = (value: T | ((val: T) => T)) => {
    const valueToStore = value instanceof Function ? value(state) : value;
    setState(valueToStore);
    
    set(key, valueToStore).catch(err => {
        console.error('IDB Set Error', err);
        addToast("Error guardando historial en disco", "error");
    });
  };

  return [state, setPersistedState];
}