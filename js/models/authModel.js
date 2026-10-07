import { supabase } from '../config/supabaseClient.js';

export const authModel = {
  async getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const { data: perfil, error } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (error) {
      console.error('Erro ao recuperar perfil:', error);
      return { user: session.user, perfil: null };
    }

    return { user: session.user, perfil };
  },

  async login(email, password) {
    const res = await supabase.auth.signInWithPassword({ email, password });
    if (res.error) throw res.error;
    return res.data;
  },

  async register(email, password, nome) {
      // Captura a URL exata da página atual (ex: https://tdsjuizdefora-art.github.io/conecta-ds/)
      const urlAtual = window.location.origin + window.location.pathname;
  
      const res = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nome },
          // FORÇA o redirecionamento a preservar a subpasta /conecta-ds/
          emailRedirectTo: urlAtual
        }
      });
      if (res.error) throw res.error;
      return res.data;
    },

  async logout() {
    return await supabase.auth.signOut();
  }
};
