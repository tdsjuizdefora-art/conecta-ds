import { supabase } from '../config/supabaseClient.js';

export const authModel = {
  // Retorna sessão do usuário autenticado e dados da tabela perfis
  async getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const { data: perfil, error } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (error) {
      console.error('Falha ao recuperar perfil associado:', error);
      return { user: session.user, perfil: null };
    }

    return { user: session.user, perfil };
  },

  // Login via e-mail e senha
  async login(email, password) {
    const res = await supabase.auth.signInWithPassword({ email, password });
    if (res.error) throw res.error;
    return res.data;
  },

  // Registro: todo usuário nasce como 'aluno' por regra do banco
  async register(email, password, nome) {
    const res = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nome } // Salvo nos metadados e lido pelo trigger handle_new_user()
      }
    });
    if (res.error) throw res.error;
    return res.data;
  },

  // Encerra a sessão
  async logout() {
    return await supabase.auth.signOut();
  }
};