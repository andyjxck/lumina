import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://rsmuxpoaabdzgfyjmvwf.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbXV4cG9hYWJkemdmeWptdndmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwNjc4MTMsImV4cCI6MjA3MjY0MzgxM30.cPVVRISCpGl4YpmZ75wK5MoPaOKIYky2popSk_v1XPE";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// User operations
export const userOperations = {
  async createUser(userData) {
    const { data, error } = await supabase
      .from('tusers')
      .insert(userData)
      .select()
      .single();
    
    return { data, error };
  },

  async getUserById(id) {
    const { data, error } = await supabase
      .from('tusers')
      .select('*')
      .eq('id', id)
      .single();
    
    return { data, error };
  },

  async getUserByEmail(email) {
    const { data, error } = await supabase
      .from('tusers')
      .select('*')
      .eq('email', email)
      .single();
    
    return { data, error };
  },

  async updateUser(id, updates) {
    const { data, error } = await supabase
      .from('tusers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    return { data, error };
  }
};

// Villager operations
export const villagerOperations = {
  async getAllVillagers() {
    const { data, error } = await supabase
      .from('tvillagers')
      .select('*')
      .order('popularity', { ascending: false });
    
    return { data, error };
  },

  async getVillagerById(id) {
    const { data, error } = await supabase
      .from('tvillagers')
      .select('*')
      .eq('id', id)
      .single();
    
    return { data, error };
  },

  async searchVillagers(query) {
    const { data, error } = await supabase
      .from('tvillagers')
      .select('*')
      .ilike('name', `%${query}%`)
      .order('popularity', { ascending: false });
    
    return { data, error };
  }
};

// Trade operations
export const tradeOperations = {
  async createTrade(tradeData) {
    const { data, error } = await supabase
      .from('ttrades')
      .insert(tradeData)
      .select()
      .single();
    
    return { data, error };
  },

  async getTradesByRequester(requesterId) {
    const { data, error } = await supabase
      .from('ttrades')
      .select(`
        *,
        villager: tvillagers(*),
        requester: tusers(*),
        supplier: tusers(*)
      `)
      .eq('requester_id', requesterId)
      .order('created_at', { ascending: false });
    
    return { data, error };
  },

  async getTradesBySupplier(supplierId) {
    const { data, error } = await supabase
      .from('ttrades')
      .select(`
        *,
        villager: tvillagers(*),
        requester: tusers(*),
        supplier: tusers(*)
      `)
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false });
    
    return { data, error };
  },

  async getTradeQueue(villagerId) {
    const { data, error } = await supabase
      .from('ttrades')
      .select(`
        *,
        villager: tvillagers(*),
        requester: tusers(*),
        supplier: tusers(*)
      `)
      .eq('villager_id', villagerId)
      .eq('status', 'QUEUED')
      .not('queue_position', 'is', null)
      .order('queue_position', { ascending: true });
    
    return { data, error };
  },

  async updateTrade(id, updates) {
    const { data, error } = await supabase
      .from('ttrades')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    return { data, error };
  },

  async acceptTrade(tradeId, supplierId) {
    // Get current queue position
    const { data: queueData } = await supabase
      .from('ttrades')
      .select('queue_position')
      .eq('villager_id', (await supabase.from('ttrades').select('villager_id').eq('id', tradeId).single()).data?.villager_id)
      .eq('status', 'QUEUED')
      .not('queue_position', 'is', null)
      .order('queue_position', { ascending: false })
      .limit(1);

    const nextPosition = queueData?.[0]?.queue_position ? queueData[0].queue_position + 1 : 1;

    const { data, error } = await supabase
      .from('ttrades')
      .update({
        supplier_id: supplierId,
        status: 'QUEUED',
        queue_position: nextPosition
      })
      .eq('id', tradeId)
      .select()
      .single();
    
    return { data, error };
  },

  async getPendingTrades() {
    const { data, error } = await supabase
      .from('ttrades')
      .select(`
        *,
        villager: tvillagers(*),
        requester: tusers(*)
      `)
      .eq('status', 'PENDING');
    
    return { data, error };
  }
};
