
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CampaignResult } from '../types';
import { useToast } from '../components/ui/Toast';

export function useCampaigns(userId: string | undefined) {
  const [history, setHistory] = useState<CampaignResult[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    if (!userId) return;

    const fetchCampaigns = async () => {
      try {
        // Intentamos cargar solo las últimas 5 campañas para no saturar.
        // Si esto falla (timeout), capturamos el error y devolvemos vacío para no bloquear la app.
        const { data, error } = await supabase
          .from('campaigns')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) {
          console.warn('Historial no disponible (posible timeout), ignorando para permitir generación.', error);
          setHistory([]); // Iniciamos vacío para que el usuario pueda trabajar
        } else if (data) {
          const mappedHistory: CampaignResult[] = data.map(item => ({
            id: item.id,
            timestamp: new Date(item.created_at).getTime(),
            platform: item.platform,
            variants: item.variants
          }));
          setHistory(mappedHistory);
        }
      } catch (e) {
        console.warn("Error crítico cargando historial, continuando...", e);
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCampaigns();
  }, [userId]);

  const saveCampaign = async (campaign: CampaignResult) => {
    if (!userId) return;

    // 1. Actualización Optimista (UI instantánea)
    setHistory(prev => [campaign, ...prev]);

    // 2. Guardado en segundo plano (Fire and Forget)
    // No esperamos el await para no bloquear la UI si la DB está lenta
    supabase.from('campaigns').insert({
      user_id: userId,
      platform: campaign.platform,
      variants: campaign.variants
    }).then(({ error }) => {
        if (error) console.error("Error guardando en background:", error);
    });
  };

  const clearHistory = async () => {
    if (!userId) return;
    setHistory([]);
    
    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('user_id', userId);

    if (error) addToast("Error borrando historial", "error");
  };

  return { history, loading, saveCampaign, clearHistory };
}
