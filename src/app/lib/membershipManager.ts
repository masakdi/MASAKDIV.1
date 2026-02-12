import { supaAdmin as supabase } from "./supabaseAdmin";

/**
 * Checks if a user's membership rank or points should be reset based on time thresholds.
 * This should be called in multiple entry points (APIs) to ensure data is always fresh.
 */
export async function checkAndResetMembership(userId: string) {
  const now = new Date();

  // 1. Fetch user data for comparison
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("membership_tier, last_rank_reset_at, membership_started_at, created_at, last_activity_at")
    .eq("id", userId)
    .single();

  if (userError || !userData) return null;

  // 2. Logic: Reset Rank (Monthly/30 days)
  const rankResetRef = userData.last_rank_reset_at || userData.membership_started_at || userData.created_at;
  const rankResetThreshold = 30 * 24 * 60 * 60 * 1000; // 30 days
  const timeSinceLastRankReset = now.getTime() - new Date(rankResetRef).getTime();

  if (userData.membership_tier !== "verified_user" && timeSinceLastRankReset > rankResetThreshold) {
    console.log(`🔄 [System] Resetting rank for user ${userId} (Rank reset trigger)`);
    await supabase
      .from("users")
      .update({
        membership_tier: "verified_user",
        is_member: false,
        member_status: "none",
        last_rank_reset_at: now.toISOString(),
        membership_expires_at: null
      })
      .eq("id", userId);
  }

  // 3. Logic: Reset Points (90 Days Inactivity)
  const activityRef = userData.last_activity_at || userData.created_at;
  const activityThreshold = 90 * 24 * 60 * 60 * 1000; // 90 days
  const timeSinceLastActivity = now.getTime() - new Date(activityRef).getTime();

  if (timeSinceLastActivity > activityThreshold) {
    const { data: currentPoints } = await supabase
      .from("user_points")
      .select("available_points")
      .eq("user_id", userId)
      .single();

    if (currentPoints && currentPoints.available_points > 0) {
      console.log(`🔄 [System] Resetting points for user ${userId} (Inactivity trigger)`);
      await supabase
        .from("user_points")
        .update({
          available_points: 0,
          total_points: 0,
          updated_at: now.toISOString()
        })
        .eq("user_id", userId);

      // Log the reset transaction
      await supabase.from("point_transactions").insert({
        user_id: userId,
        points: -currentPoints.available_points,
        transaction_type: "reset",
        description: "แต้มถูกรีเซ็ตเนื่องจากไม่มีการใช้งานเกินกำหนด"
      });
    }
  }
}
