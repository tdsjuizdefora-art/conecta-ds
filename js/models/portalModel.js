import { supabase } from '../config/supabaseClient.js';

export const portalModel = {
  // NOTÍCIAS
  async getNoticias() {
    const { data, error } = await supabase
      .from('noticias')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  // PROJETOS
  async getProjetos() {
    const { data, error } = await supabase
      .from('projetos')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async criarProjeto(projeto) {
    const { error } = await supabase.from('projetos').insert([projeto]);
    if (error) throw error;
  },

  // VAGAS
  async getVagas() {
    const { data, error } = await supabase
      .from('vagas')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async criarVaga(vaga) {
    const { error } = await supabase.from('vagas').insert([vaga]);
    if (error) throw error;
  },

  // DESAFIOS
  async getDesafios() {
    const { data, error } = await supabase
      .from('desafios')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  // BADGES DO ESTUDANTE
  async getBadgesDoEstudante(estudanteId) {
    const { data, error } = await supabase
      .from('estudante_badges')
      .select('badge_id, conquistado_em, badges(nome, icone, descricao)')
      .eq('estudante_id', estudanteId);
    if (error) throw error;
    return data;
  },

  // ATUALIZAÇÃO DO PRÓPRIO PERFIL (RESTABELECIDO)
  async atualizarPerfil(usuarioId, dados) {
    const { data, error } = await supabase
      .from('perfis')
      .update(dados)
      .eq('id', usuarioId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};