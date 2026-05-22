/**
 * Supabase client integration and synchronization layer for BarberQ.
 * If you configure the VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env
 * settings, all actions will automatically push, update, and persist to Supabase in real-time.
 * 
 * -------------------------------------------------------------
 * SQL SCRIPT TO PASTE INTO THE SUPABASE SQL EDITOR:
 * -------------------------------------------------------------
 * 
 * -- 1. Shop settings table
 * create table if not exists shop_settings (
 *   key text primary key,
 *   value text not null,
 *   updated_at timestamp with time zone default timezone('utc'::text, now()) not null
 * );
 * 
 * -- 2. Barbers table
 * create table if not exists barbers (
 *   id text primary key,
 *   name text not null,
 *   initials text not null,
 *   specialties text[] not null,
 *   status text not null,
 *   avg_time integer not null,
 *   updated_at timestamp with time zone default timezone('utc'::text, now()) not null
 * );
 * 
 * -- 3. Services table
 * create table if not exists services (
 *   id text primary key,
 *   name text not null,
 *   price numeric not null,
 *   duration integer not null,
 *   updated_at timestamp with time zone default timezone('utc'::text, now()) not null
 * );
 * 
 * -- 4. Queue Items table
 * create table if not exists queue_items (
 *   id text primary key,
 *   client_name text not null,
 *   phone text,
 *   barber_id text not null,
 *   service_id text not null,
 *   service_name text not null,
 *   price numeric not null,
 *   status text not null, -- waiting, active, completed, skipped, cancelled
 *   joined_at text not null,
 *   started_at text,
 *   completed_at text,
 *   updated_at timestamp with time zone default timezone('utc'::text, now()) not null
 * );
 * 
 * -- 5. Transactions table
 * create table if not exists transactions (
 *   id text primary key,
 *   client_name text not null,
 *   service_name text not null,
 *   price numeric not null,
 *   timestamp text not null,
 *   barber_name text not null,
 *   barber_id text not null,
 *   created_at timestamp with time zone default timezone('utc'::text, now()) not null
 * );
 * 
 * -- 6. Shops table
 * create table if not exists shops (
 *   id uuid default gen_random_uuid() primary key,
 *   name text not null,
 *   address text not null,
 *   phone text not null,
 *   owner_id uuid not null default auth.uid(),
 *   is_open boolean not null default true,
 *   created_at timestamp with time zone default timezone('utc'::text, now()) not null
 * );
 * 
 * -- Enable real-time publication for live screens with error-tolerant idempotent script
 * alter table public.queue_items replica identity full;
 * alter table public.barbers replica identity full;
 * alter table public.services replica identity full;
 * alter table public.shops replica identity full;
 * 
 * do $$
 * begin
 *   begin
 *     alter publication supabase_realtime add table public.queue_items;
 *   exception when duplicate_object then null;
 *   end;
 *   
 *   begin
 *     alter publication supabase_realtime add table public.barbers;
 *   exception when duplicate_object then null;
 *   end;
 *   
 *   begin
 *     alter publication supabase_realtime add table public.services;
 *   exception when duplicate_object then null;
 *   end;
 *   
 *   begin
 *     alter publication supabase_realtime add table public.shops;
 *   exception when duplicate_object then null;
 *   end;
 *   
 *   begin
 *     alter publication supabase_realtime add table public.shop_settings;
 *   exception when duplicate_object then null;
 *   end;
 *   
 *   begin
 *     alter publication supabase_realtime add table public.transactions;
 *   exception when duplicate_object then null;
 *   end;
 * end;
 * $$;
 * 
 */

import { createClient } from '@supabase/supabase-js';
import { Barber, Service, QueueItem, Transaction } from '../types';

// Helper to cleanly extract environment variables free of quotes or placeholder values
const cleanEnvVar = (val: string): string => {
  if (!val) return '';
  let cleaned = val.trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1);
  }
  cleaned = cleaned.trim();
  if (
    cleaned === 'VITE_SUPABASE_URL_PLACEHOLDER' || 
    cleaned === 'VITE_SUPABASE_ANON_KEY_PLACEHOLDER' ||
    cleaned === 'VITE_SUPABASE_ANON_KEy' ||
    cleaned === 'VITE_SUPABASE_ANON_KEY'
  ) {
    return '';
  }
  return cleaned;
};

// @ts-ignore
const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
// @ts-ignore
const rawSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEy || '';

const supabaseUrl = cleanEnvVar(rawSupabaseUrl);
const supabaseAnonKey = cleanEnvVar(rawSupabaseAnonKey);

console.log("[Supabase Init] rawUrl:", rawSupabaseUrl, "rawAnonKey:", rawSupabaseAnonKey ? rawSupabaseAnonKey.substring(0, 10) + "..." : "empty");
console.log("[Supabase Init] cleanUrl:", supabaseUrl, "cleanAnonKey length:", supabaseAnonKey ? supabaseAnonKey.length : 0);

// Lazy initialization of the Supabase Client
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export function isSupabaseConnected(): boolean {
  return !!supabase;
}

export interface ShopRow {
  id?: string;
  name: string;
  address: string;
  phone: string;
  owner_id?: string;
  is_open?: boolean;
}

// 0. Supabase Authentication and Shop API functions
export async function dbSignUp(email: string, password: string) {
  if (!supabase) throw new Error("Supabase n'est pas configuré");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function dbSignIn(email: string, password: string) {
  if (!supabase) throw new Error("Supabase n'est pas configuré");
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  } catch (error: any) {
    const rawMessage = error?.message || '';
    console.error("[Supabase Auth] Sign in failed:", error);
    
    // Check if the email must be confirmed
    if (rawMessage.includes('confirm') || rawMessage.includes('verification')) {
      throw new Error("Votre compte a été enregistré mais requiert une confirmation par email. Veuillez vérifier vos emails, ou désactiver la confirmation d'email dans Supabase (Auth -> Providers -> Email -> Confirm email).");
    }

    const isInvalidCreds = rawMessage === 'Invalid login credentials' || 
                           rawMessage.toLowerCase().includes('credentials') || 
                           rawMessage.toLowerCase().includes('invalid');

    if (isInvalidCreds) {
      console.log("[Supabase Auth] Attempting auto-signup fallback...");
      try {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        
        if (signUpError) {
          throw signUpError;
        }

        if (signUpData?.session) {
          console.log("[Supabase Auth] Auto-signup success with active session!");
          try {
            await supabase.from('shops').insert({
              name: "Salon Barber_Pro",
              address: "Avenue des Champs-Élysées, Paris",
              phone: "+33 1 23 45 67 89",
              owner_id: signUpData.user?.id
            });
          } catch (shopErr) {
            console.warn("Could not insert default shop:", shopErr);
          }
          return signUpData;
        } else {
          // If signup works but doesn't return session, email confirmation is active in Supabase!
          throw new Error("Compte créé avec succès ! Cependant, la confirmation par e-mail est activée dans votre compte Supabase. Veuillez cliquer sur le lien reçu par e-mail ou désactiver l'option 'Confirm email' dans 'Authentication -> Providers -> Email' de Supabase.");
        }
      } catch (fallbackErr: any) {
        console.warn("[Supabase Auth] Auto-signup fallback option failed:", fallbackErr);
        throw new Error(fallbackErr?.message || "Email ou mot de passe incorrect.");
      }
    }
    
    throw new Error(rawMessage || "Email ou mot de passe incorrect. Si vous n'avez pas encore de compte, veuillez cliquer sur 'Créer ma boutique' ci-dessous.");
  }
}

export async function dbSignOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function dbGetCurrentUser() {
  if (!supabase) return null;
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) return null;
  return user;
}

export async function dbInsertShop(shop: ShopRow) {
  if (!supabase) throw new Error("Supabase n'est pas configuré");
  const user = await dbGetCurrentUser();
  const owner_id = user ? user.id : undefined;

  const { data, error } = await supabase.from('shops').insert({
    name: shop.name,
    address: shop.address,
    phone: shop.phone,
    is_open: true,
    owner_id: owner_id
  }).select().single();

  if (error) throw error;
  return data;
}

export async function dbGetShopsByOwner() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('shops').select('*');
  if (error) {
    console.error("Error fetching shops:", error);
    return [];
  }
  return data;
}

// 1. Fetch initial dataset from Supabase if configured (hybrid/fallback style)
export async function dbFetchAll() {
  if (!supabase) return null;
  try {
    const [shopRes, barbersRes, servicesRes, queueRes, txsRes] = await Promise.all([
      supabase.from('shop_settings').select('*'),
      supabase.from('barbers').select('*'),
      supabase.from('services').select('*'),
      supabase.from('queue_items').select('*'),
      supabase.from('transactions').select('*')
    ]);

    const shopName = shopRes.data?.find(r => r.key === 'shop_name')?.value;
    
    // Map database snake_case back to camelCase
    const barbers: Barber[] | undefined = barbersRes.data?.map(b => ({
      id: b.id,
      name: b.name,
      initials: b.initials,
      specialties: b.specialties,
      status: b.status,
      avgTime: b.avg_time
    }));

    const services: Service[] | undefined = servicesRes.data?.map(s => ({
      id: s.id,
      name: s.name,
      price: Number(s.price),
      duration: s.duration
    }));

    const queue: QueueItem[] | undefined = queueRes.data?.map(q => ({
      id: q.id,
      clientName: q.client_name,
      phone: q.phone || undefined,
      barberId: q.barber_id,
      serviceId: q.service_id,
      serviceName: q.service_name,
      price: Number(q.price),
      status: q.status,
      joinedAt: q.joined_at,
      startedAt: q.started_at || undefined,
      completedAt: q.completed_at || undefined
    }));

    const transactions: Transaction[] | undefined = txsRes.data?.map(t => ({
      id: t.id,
      clientName: t.client_name,
      serviceName: t.service_name,
      amount: Number(t.price),
      timestamp: t.timestamp,
      barberName: t.barber_name,
      barberId: t.barber_id,
      status: 'paid' as const
    }));

    return {
      shopName,
      barbers: barbers && barbers.length > 0 ? barbers : undefined,
      services: services && services.length > 0 ? services : undefined,
      queue: queue,
      transactions: transactions
    };
  } catch (err) {
    console.error("Error fetching Supabase data:", err);
    return null;
  }
}

// 2. Insert or update queue items
export async function dbUpsertQueueItem(item: QueueItem) {
  if (!supabase) return;
  try {
    await supabase.from('queue_items').upsert({
      id: item.id,
      client_name: item.clientName,
      phone: item.phone || null,
      barber_id: item.barberId,
      service_id: item.serviceId,
      service_name: item.serviceName,
      price: item.price,
      status: item.status,
      joined_at: item.joinedAt,
      started_at: item.startedAt || null,
      completed_at: item.completedAt || null
    });
  } catch (err) {
    console.error("Error upserting queue item:", err);
  }
}

// 3. Remove queue items
export async function dbDeleteQueueItem(id: string) {
  if (!supabase) return;
  try {
    await supabase.from('queue_items').delete().eq('id', id);
  } catch (err) {
    console.error("Error deleting queue item:", err);
  }
}

// 4. Save transactions
export async function dbInsertTransaction(tx: Transaction) {
  if (!supabase) return;
  try {
    await supabase.from('transactions').insert({
      id: tx.id,
      client_name: tx.clientName,
      service_name: tx.serviceName,
      price: tx.amount,
      timestamp: tx.timestamp,
      barber_name: tx.barberName,
      barber_id: tx.barberId
    });
  } catch (err) {
    console.error("Error inserting transaction:", err);
  }
}

// 5. Save shop name
export async function dbSaveShopName(name: string) {
  if (!supabase) return;
  try {
    await supabase.from('shop_settings').upsert({
      key: 'shop_name',
      value: name
    });
  } catch (err) {
    console.error("Error updating shop name:", err);
  }
}

// 6. Save coiffeur accounts
export async function dbSaveBarber(b: Barber) {
  if (!supabase) return;
  try {
    await supabase.from('barbers').upsert({
      id: b.id,
      name: b.name,
      initials: b.initials,
      specialties: b.specialties,
      status: b.status,
      avg_time: b.avgTime
    });
  } catch (err) {
    console.error("Error saving barber:", err);
  }
}

export async function dbDeleteBarber(id: string) {
  if (!supabase) return;
  try {
    await supabase.from('barbers').delete().eq('id', id);
  } catch (err) {
    console.error("Error deleting barber:", err);
  }
}

// 7. Save services list
export async function dbSaveService(s: Service) {
  if (!supabase) return;
  try {
    await supabase.from('services').upsert({
      id: s.id,
      name: s.name,
      price: s.price,
      duration: s.duration
    });
  } catch (err) {
    console.error("Error saving service:", err);
  }
}

export async function dbDeleteService(id: string) {
  if (!supabase) return;
  try {
    await supabase.from('services').delete().eq('id', id);
  } catch (err) {
    console.error("Error deleting service:", err);
  }
}

// 8. Force wipe both dynamic tables
export async function dbResetAll() {
  if (!supabase) return;
  try {
    await Promise.all([
      supabase.from('queue_items').delete().neq('id', 'placeholder'),
      supabase.from('transactions').delete().neq('id', 'placeholder')
    ]);
  } catch (err) {
    console.error("Error resetting tables:", err);
  }
}
