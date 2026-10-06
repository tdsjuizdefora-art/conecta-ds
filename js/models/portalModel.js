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
  async criarNoticia(noticia) {
    const { error } = await supabase.from('noticias').insert([noticia]);
    if (error) throw error;
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
  async aprovarProjeto(id) {
    const { error } = await supabase
      .from('projetos')
      .update({ status: 'aprovado' })
      .eq('id', id);
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
  async aprovarVaga(id) {
    const { error } = await supabase
      .from('vagas')
      .update({ status: 'aprovada' })
      .eq('id', id);
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
  async criarDesafio(desafio) {
    const { error } = await supabase.from('desafios').insert([desafio]);
    if (error) throw error;
  },

  // BADGES DO ESTUDANTE
  async getBadgesDoEstudante(estudanteId) {
    const { data, error } = await supabase
      .from('estudante_badges')
      .select('badge_id, conquistado_em, badges(nome, icone, descricao)')
      .eq('estudante_id', estudanteId);
    if (error) throw error;
    return data;
  }
};