// Substitua pelas credenciais de Project Settings -> API no painel do Supabase
export const SUPABASE_URL = 'https://yjeuzcufhegwtfgjkfvk.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_T1-DGjfL4Aj31WgWgh8cPA_xe6URk5i';

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);