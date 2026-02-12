import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const { line_id } = await req.json();

    if (!line_id) {
      return NextResponse.json({ error: "Missing line_id" }, { status: 400 });
    }

    console.log("🧹 ทำความสะอาด auth user สำหรับ LINE ID:", line_id);

    const email = `line_${line_id}@line.local`;

    // 1. หา auth user ทั้งหมด
    const { data: allUsers } = await admin.auth.admin.listUsers();
    console.log(`📊 จำนวน auth users ทั้งหมด: ${allUsers.users.length}`);

    // 2. หา user ที่มี email ตรงกัน
    const userToDelete = allUsers.users.find((u: any) => u.email === email);

    if (!userToDelete) {
      console.log("✅ ไม่พบ auth user ที่ต้องลบ");
      return NextResponse.json({
        message: "No auth user found",
        email
      });
    }

    console.log("🗑️ พบ auth user ที่ต้องลบ:", userToDelete.id, userToDelete.email);

    // 3. ลบ auth user
    const { error: deleteAuthErr } = await admin.auth.admin.deleteUser(userToDelete.id);

    if (deleteAuthErr) {
      console.error("❌ ลบ auth user ล้มเหลว:", deleteAuthErr);
      throw deleteAuthErr;
    }

    console.log("✅ ลบ auth user สำเร็จ");

    // 4. ลบ public user (ถ้ามี)
    const { error: deletePublicErr } = await admin
      .from("users")
      .delete()
      .eq("line_user_id", line_id);

    if (deletePublicErr) {
      console.warn("⚠️ ลบ public user ล้มเหลว (อาจไม่มีอยู่แล้ว):", deletePublicErr);
    } else {
      console.log("✅ ลบ public user สำเร็จ");
    }

    return NextResponse.json({
      success: true,
      message: "Cleaned up successfully",
      deleted_auth_user_id: userToDelete.id,
    });
  } catch (error: any) {
    console.error("❌ เกิดข้อผิดพลาด:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
