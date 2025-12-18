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
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching campaigns:', error);
      } else if (data) {
        // Mapear de DB a tipos de TS
        const mappedHistory: CampaignResult[] = data.map(item => ({
          id: item.id,
          timestamp: new Date(item.created_at).getTime(),
          platform: item.platform,
          variants: item.variants
        }));
        setHistory(mappedHistory);
      }
      setLoading(false);
    };

    fetchCampaigns();
  }, [userId]);

  const saveCampaign = async (campaign: CampaignResult) => {
    if (!userId) return;

    // UI Optimista
    setHistory(prev => [campaign, ...prev]);

    const { error } = await supabase.from('campaigns').insert({
      user_id: userId,
      platform: campaign.platform,
      variants: campaign.variants // Supabase convierte array JSON automáticamente
    });

    if (error) {
      console.error("Error saving campaign:", error);
      addToast("Error guardando en el historial", "error");
    }
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