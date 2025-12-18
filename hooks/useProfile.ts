import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { BusinessSettings, UserSubscription, PlanTier } from '../types';
import { useToast } from '../components/ui/Toast';
import { PLANS } from '../constants';

const DEFAULT_SETTINGS: BusinessSettings = {
  name: 'Mi Marca',
  industry: 'General',
  tone: 'Profesional',
  website: '',
  targetAudience: 'General',
  primaryColor: '#6366f1',
  secondaryColor: '#ec4899',
};

export function useProfile(userId: string | undefined) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  
  // Estado local sincronizado con DB
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_SETTINGS);
  const [subscription, setSubscription] = useState<UserSubscription>({
    plan: 'free',
    credits: 0,
    maxCredits: 5
  });

  useEffect(() => {
    if (!userId) return;

    const fetchProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) throw error;

        if (data) {
          // Determinar maxCredits basado en el plan almacenado para consistencia
          const planDetails = PLANS.find(p => p.id === data.plan) || PLANS[0];
          
          setSubscription({
            plan: data.plan as PlanTier,
            credits: data.credits,
            maxCredits: planDetails.credits
          });
          
          if (data.business_settings) {
            setSettings({ ...DEFAULT_SETTINGS, ...data.business_settings });
          }
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId]);

  // Actualizar configuración del negocio
  const updateSettings = async (key: string, value: string) => {
    if (!userId) return;
    
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings); // UI Optimista

    const { error } = await supabase
      .from('profiles')
      .update({ business_settings: newSettings })
      .eq('id', userId);

    if (error) {
      addToast("Error guardando configuración", "error");
    }
  };

  // Restar créditos (Llamado después de generar campaña)
  const decrementCredits = async () => {
    if (!userId || subscription.credits <= 0) return;

    // UI Optimista
    setSubscription(prev => ({ ...prev, credits: prev.credits - 1 }));

    // RPC Call sería mejor, pero por ahora update directo
    const { error } = await supabase
      .from('profiles')
      .update({ credits: subscription.credits - 1 })
      .eq('id', userId);
      
    if (error) console.error("Error updating credits", error);
  };

  // Actualizar Plan
  const upgradePlan = async (newPlan: PlanTier) => {
    if (!userId) return;
    
    const planDetails = PLANS.find(p => p.id === newPlan);
    if (!planDetails) {
        addToast("Plan inválido", "error");
        return;
    }

    const newCredits = planDetails.credits;
    
    // Al hacer upgrade, reseteamos los créditos al máximo del nuevo plan (Bonus de bienvenida)
    setSubscription({ plan: newPlan, credits: newCredits, maxCredits: newCredits });

    const { error } = await supabase
      .from('profiles')
      .update({ plan: newPlan, credits: newCredits })
      .eq('id', userId);
      
    if (error) addToast("Error actualizando plan", "error");
  };

  return { 
    settings, 
    subscription, 
    loading, 
    updateSettings, 
    decrementCredits,
    upgradePlan
  };
}