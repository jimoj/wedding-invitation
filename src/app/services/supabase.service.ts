import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      'https://hvcmshqvoonajcpuiefk.supabase.co', //  URL de Supabase
      'sb_publishable_6Se5rf2ZUZvApKYDysMdGw_yHn4bLxg' // clave anónima
    );
  }

  async saveRsvp(rsvpData: any) {
    const { data, error } = await this.supabase
      .from('invitados') // table name
      .insert([rsvpData]);
    
    if (error) throw error;
    return data;
  }
}