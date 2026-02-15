'use server';

import { supabaseServer as supabase } from '@/app/lib/supabaseServer';
import { revalidatePath } from 'next/cache';

export type Coupon = {
  id: string;
  code: string;
  description: string | null;
  discount_type: 'fixed' | 'percent';
  discount_value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  usage_limit: number | null;
  usage_per_user_limit: number;
  used_count: number;
  start_date: string;
  end_date: string | null;
  applicable_types: string[]; // JSONB stored as array
  allowed_roles: string[]; // New: ["all", "member", "silver", "gold"]
  is_active: boolean;
  is_public: boolean;
  created_at: string;
};

export async function getCoupons() {

  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []).map(c => ({
    ...c,
    discount_value: Number(c.discount_value),
    min_order_amount: Number(c.min_order_amount),
    max_discount_amount: c.max_discount_amount ? Number(c.max_discount_amount) : null,
    usage_limit: c.usage_limit ? Number(c.usage_limit) : null,
    used_count: Number(c.used_count || 0),
    allowed_roles: typeof c.allowed_roles === 'string' ? JSON.parse(c.allowed_roles) : (c.allowed_roles || ['all'])
  })) as Coupon[];
}

export async function createCoupon(coupon: Omit<Coupon, 'id' | 'created_at' | 'updated_at' | 'used_count'>) {

  
  // Basic validation
  if (coupon.discount_type === 'percent' && coupon.discount_value > 100) {
    return { error: 'Percentage discount cannot exceed 100%' };
  }

  const { data, error } = await supabase
    .from('coupons')
    .insert([coupon])
    .select()
    .single();

  if (error) {
    console.error('Error creating coupon:', error);
    return { error: error.message };
  }
  
  revalidatePath('/Admins/Coupons');
  return { data };
}

export async function updateCoupon(id: string, updates: Partial<Coupon>) {

  const { data, error } = await supabase
    .from('coupons')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return { error: error.message };
  
  revalidatePath('/Admins/Coupons');
  return { data };
}

export async function deleteCoupon(id: string) {

  const { error } = await supabase.from('coupons').delete().eq('id', id);
  
  if (error) return { error: error.message };
  
  revalidatePath('/Admins/Coupons');
  return { success: true };
}

// User Actions

export async function collectCoupon(userId: string, code: string) {


  // 1. Find coupon
  const { data: coupon, error: couponError } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', code.toUpperCase())
    .single();

  if (couponError || !coupon) {
    return { error: 'Coupon not found' };
  }

  if (!coupon.is_active) {
    return { error: 'This coupon is inactive' };
  }

  const now = new Date();
  if (new Date(coupon.start_date) > now) {
    return { error: 'This coupon is not valid yet' };
  }
  if (coupon.end_date && new Date(coupon.end_date) < now) {
    return { error: 'This coupon has expired' };
  }

  if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
    return { error: 'This coupon has reached its usage limit' };
  }

  // Role validation
  const allowedRoles = typeof coupon.allowed_roles === 'string' 
        ? JSON.parse(coupon.allowed_roles) 
        : (coupon.allowed_roles || ['all']);

  if (!allowedRoles.includes('all')) {
     const userTier = await getUserTier(userId);
     if (!allowedRoles.includes(userTier)) {
         return { error: 'You are not eligible for this coupon.' };
     }
  }

  // 2. Check if user already collected
  const { data: existing, error: existingError } = await supabase
    .from('user_coupons')
    .select('*')
    .eq('user_id', userId)
    .eq('coupon_id', coupon.id);

  if (existingError) return { error: existingError.message };

  if (existing && existing.length >= coupon.usage_per_user_limit) {
    return { error: 'You have already collected/used this coupon the maximum number of times' };
  }

  // 3. Collect (Insert into user_coupons)
  const { error: insertError } = await supabase
    .from('user_coupons')
    .insert({
      user_id: userId,
      coupon_id: coupon.id,
      status: 'collected'
    });

  if (insertError) return { error: insertError.message };

  revalidatePath('/coupons');
  return { success: true, message: 'Coupon collected successfully!' };
}

export async function getUserCoupons(userId: string) {
    const now = new Date();
    // 1. Get manually collected coupons
    const { data: collected, error: ucError } = await supabase
        .from('user_coupons')
        .select(`
            id,
            status,
            coupons (*)
        `)
        .eq('user_id', userId)
        .eq('status', 'collected');
    
    if (ucError) throw new Error(ucError.message);

    // 2. Get active public coupons
    const nowStr = now.toISOString();
    const { data: publicCoupons, error: pError } = await supabase
        .from('coupons')
        .select('*')
        .eq('is_active', true)
        .eq('is_public', true)
        .lte('start_date', nowStr);
        // Note: we don't filter out expired here so they can still be seen but marked as expired
        // .or(`end_date.is.null,end_date.gte.${nowStr}`);

    if (pError) throw new Error(pError.message);

    // 3. Merge and formatting
    const formattedCollected = (collected || []).map((item: any) => {
        const couponData = Array.isArray(item.coupons) ? item.coupons[0] : item.coupons;
        const isExpired = couponData?.end_date ? new Date(couponData.end_date) < now : false;
        return {
            ...(couponData || {}),
            discount_value: Number(couponData?.discount_value || 0),
            min_order_amount: Number(couponData?.min_order_amount || 0),
            max_discount_amount: couponData?.max_discount_amount ? Number(couponData.max_discount_amount) : null,
            user_coupon_id: item.id,
            allowed_roles: typeof couponData?.allowed_roles === 'string' 
                ? JSON.parse(couponData.allowed_roles) 
                : (couponData?.allowed_roles || ['all']),
            is_public: couponData?.is_public || false,
            is_expired: isExpired
        };
    });

    const collectedIds = new Set(formattedCollected.map(c => c.id));

    const formattedPublic = (publicCoupons || [])
        .filter(pc => !collectedIds.has(pc.id))
        .map(pc => ({
            ...pc,
            discount_value: Number(pc.discount_value || 0),
            min_order_amount: Number(pc.min_order_amount || 0),
            max_discount_amount: pc.max_discount_amount ? Number(pc.max_discount_amount) : null,
            user_coupon_id: `public_${pc.id}`, // Virtual ID
            allowed_roles: typeof pc.allowed_roles === 'string' 
                ? JSON.parse(pc.allowed_roles) 
                : (pc.allowed_roles || ['all']),
            is_public: true,
            is_expired: pc.end_date ? new Date(pc.end_date) < now : false
        }));

    return [...formattedCollected, ...formattedPublic];
}

export async function getUserTier(userId: string) {
    const { data, error } = await supabase
        .from('users')
        .select('membership_tier')
        .eq('id', userId)
        .single();
    
    if (error) return 'verified_user';
    return data?.membership_tier || 'verified_user';
}

export async function calculateDiscount(couponCode: string, orderTotal: number, serviceType: string = 'all', userId?: string) {

     const { data: coupon, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', couponCode.toUpperCase())
    .single();
    
    if (error || !coupon) return { valid: false, message: 'Invalid coupon' };

    // Standard validations (expiry, limits) - simplified for calculation check
    if (!coupon.is_active) return { valid: false, message: 'Coupon inactive' };
    
    const now = new Date();
    if (coupon.end_date && new Date(coupon.end_date) < now) {
         return { valid: false, message: 'Coupon expired' };
    }
    
    // Check applicable type
    const types: string[] = typeof coupon.applicable_types === 'string' 
        ? JSON.parse(coupon.applicable_types) 
        : coupon.applicable_types;
        
    if (!types.includes('all') && !types.includes(serviceType)) {
        return { valid: false, message: `Coupon not applicable for ${serviceType}` };
    }

    // Role Check
    if (userId) {
        const allowedRoles: string[] = typeof coupon.allowed_roles === 'string'
            ? JSON.parse(coupon.allowed_roles)
            : (coupon.allowed_roles || ['all']);

        if (!allowedRoles.includes('all')) {
             const userTier = await getUserTier(userId);
             if (!allowedRoles.includes(userTier)) {
                 return { valid: false, message: `For ${allowedRoles.join(', ')} members only` };
             }
        }
    }

    if (orderTotal < coupon.min_order_amount) {
        return { valid: false, message: `Min order amount is ${coupon.min_order_amount}` };
    }

    let discount = 0;
    if (coupon.discount_type === 'fixed') {
        discount = coupon.discount_value;
    } else {
        discount = (orderTotal * coupon.discount_value) / 100;
        if (coupon.max_discount_amount) {
            discount = Math.min(discount, coupon.max_discount_amount);
        }
    }

    return { valid: true, discountAmount: discount, coupon };
}

export async function markCouponUsed(userId: string, couponCode: string, orderId: string) {


    // 1. Get Coupon
    const { data: coupon, error: couponError } = await supabase
        .from('coupons')
        .select('id, used_count')
        .eq('code', couponCode)
        .single();
    
    if (couponError || !coupon) return { error: `Coupon not found: ${couponCode}` };

    // 2. Get User Coupon Record (Collected)
    // We try to find a 'collected' one to mark as used.
    const { data: userCoupon, error: ucError } = await supabase
        .from('user_coupons')
        .select('id')
        .eq('user_id', userId)
        .eq('coupon_id', coupon.id)
        .eq('status', 'collected')
        .limit(1)
        .single();

    if (ucError && ucError.code !== 'PGRST116') { // PGRST116 is no rows
         console.error("Error finding user collected coupon:", ucError);
    }
    
    // If user hasn't collected it but used it (e.g. direct code entry if we allow it without collection first),
    // we should create a new record as 'used' immediately. 
    // BUT per design, users usually 'collect' then 'use'. 
    // IF the system allows auto-collect-and-use, we handle that here.
    // For now, let's assume if it's not collected, we create a new 'used' entry.
    
    if (userCoupon) {
        // Mark existing as used
        await supabase
            .from('user_coupons')
            .update({ status: 'used', used_at: new Date().toISOString(), order_id: orderId })
            .eq('id', userCoupon.id);
    } else {
        // Create new used entry
        await supabase
            .from('user_coupons')
            .insert({
                user_id: userId,
                coupon_id: coupon.id,
                status: 'used',
                used_at: new Date().toISOString(),
                order_id: orderId
            });
    }

    // 3. Increment global usage count
    await supabase
        .from('coupons')
        .update({ used_count: (coupon.used_count || 0) + 1 })
        .eq('id', coupon.id);
        
    return { success: true };
}
