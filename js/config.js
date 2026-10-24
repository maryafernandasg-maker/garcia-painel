// Configuração do painel. A chave pública (publishable/anon) é feita para ficar no site:
// sem login ela não dá acesso a nenhum dado, porque o banco só libera registros da conta logada.
// NUNCA coloque aqui a service_role key ou a secret key.
window.GARCIA_CONFIG = {
  supabaseUrl: "https://cdcchzizdwhobetzjckc.supabase.co",
  supabaseKey: "",   // publishable key (sb_publishable_...) ou anon public key
  nome: "Marya",     // como o painel chama você na saudação
};
