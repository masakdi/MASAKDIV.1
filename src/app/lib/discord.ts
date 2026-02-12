export async function sendDiscordNotification(type: string, data: any) {
  try {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      console.warn("⚠️ DISCORD_WEBHOOK_URL not configured");
      return { error: "Webhook not configured" };
    }

    let embed: any;

    // สร้าง embed ตามประเภทของ notification
    switch (type) {
      case "new_order":
        // สร้างข้อมูลตะกร้าแบบละเอียด
        let basketsDetail = "-";
        if (data.addons?.baskets && data.addons.baskets.length > 0) {
          basketsDetail = data.addons.baskets
            .map((basket: any, index: number) => {
              const size = basket.size || "-";
              const serviceMap: Record<string, string> = {
                wash_only: "ซักอย่างเดียว",
                dry_only: "อบอย่างเดียว",
                wash_and_dry: "ซัก + อบ",
              };
              const serviceText = serviceMap[basket.service] || basket.service || "-";

              const addonsArr: string[] = [];
              if (basket.softener) addonsArr.push("ปรับผ้านุ่ม");
              if (basket.detergent) addonsArr.push("ผงซักฟอก");
              const addons = addonsArr.length > 0 ? addonsArr.join(", ") : "ไม่มี";
              const qty = basket.qty || 1;

              return `**ตะกร้าที่ ${index + 1}:**\n• ไซส์: ${size} (x${qty})\n• บริการ: ${serviceText}\n• น้ำยาเพิ่มเติม: ${addons}`;
            })
            .join("\n\n");
        }

        // แยกค่าใช้จ่ายแต่ละประเภท
        const basePrice = data.base_price || 0;
        const suppliesTotal = data.supplies_total || 0;
        const deliveryFee = data.delivery_fee || 0;
        const platformFee = data.platform_fee || 0;
        const discountAmount = data.discount_amount || 0;
        const total = basePrice + suppliesTotal + deliveryFee + platformFee - discountAmount;

        // โหมดจัดส่ง
        const deliveryModeMap: Record<string, string> = {
          pickup_and_return: "🚚 รับ + ส่งคืน",
          pickup_only: "🚚 รับอย่างเดียว",
        };
        const deliveryMode = deliveryModeMap[data.delivery?.mode] || data.delivery?.mode || "-";

        // ลิงก์รูปภาพ
        const slipUrl = data.slip_url || null;
        const basketPhotoUrl = data.addons?.basket_photo_url || null;

        const isBooking = data.order_type === 'booking';
        const bookingInfo = isBooking && data.scheduled_date 
          ? `\n🗓️ **จองวันรับบริการ:** ${new Date(data.scheduled_date).toLocaleDateString('th-TH', { 
              weekday: 'long', 
              day: 'numeric', 
              month: 'long',
              year: 'numeric' 
            })}` 
          : "";

        const isMember = data.membership_tier && data.membership_tier !== "verified_user";
        const memberTag = isMember ? `\n**(💎 สมาชิก: ${data.membership_tier})**` : "";

        embed = {
          title: isBooking ? "📅 มีคิวจองใหม่เข้ามา!" : "🆕 ออเดอร์ใหม่เข้ามา!",
          color: isBooking ? 0x8B5CF6 : 0x1257FF,
          description: `**Order:** ${data.order_number || `#${data.id.slice(0, 8)}`}\n**${deliveryMode}**${bookingInfo}`,
          fields: [
            { name: "👤 ข้อมูลลูกค้า", value: `**ชื่อ:** ${data.contact_name || "-"}\n**เบอร์:** ${data.contact_phone || "-"}${memberTag}`, inline: false },
            { 
              name: "📍 ที่อยู่จัดส่ง", 
              value: `${data.delivery?.address || "-"}${data.delivery?.google_map_link ? `\n🔗 [ดูแผนที่](${data.delivery.google_map_link})` : ""}`, 
              inline: false 
            },
            { name: "🧺 รายละเอียดตะกร้า", value: basketsDetail, inline: false },
            { name: "💵 รายละเอียดค่าใช้จ่าย", value: `• ค่าซัก: ${(data.wash_price || 0).toLocaleString("th-TH")} ฿\n• ค่าอบ: ${(data.dry_price || 0).toLocaleString("th-TH")} ฿\n• ค่าน้ำยา: ${suppliesTotal.toLocaleString("th-TH")} ฿\n• ค่าส่ง: ${deliveryFee.toLocaleString("th-TH")} ฿\n• ค่าบริการ: ${platformFee.toLocaleString("th-TH")} ฿${discountAmount > 0 ? `\n• ส่วนลด: -${discountAmount.toLocaleString("th-TH")} ฿` : ""}`, inline: false },
            { name: "✨ ยอดรวมต้องชำระ", value: `**${total.toLocaleString("th-TH")} ฿**`, inline: false },
          ],
          timestamp: new Date().toISOString(),
          footer: { text: "MASAKDI Admin System" },
        };

        if (slipUrl) embed.fields.push({ name: "📄 สลิปโอนเงิน", value: `[คลิกดูสลิป](${slipUrl})`, inline: true });
        if (basketPhotoUrl) embed.fields.push({ name: "🖼️ รูปตะกร้าผ้า", value: `[คลิกดูรูปตะกร้า](${basketPhotoUrl})`, inline: true });
        if (data.note) embed.fields.push({ name: "📝 หมายเหตุ", value: data.note, inline: false });
        break;

      case "status_update":
        const statusEmoji: Record<string, string> = { pending: "⏳", accepted: "✅", washing: "🧺", ready: "📦", delivering: "🚚", completed: "✨", cancelled: "❌" };
        const statusNameTH: Record<string, string> = { pending: "รอดำเนินการ", accepted: "รับงานแล้ว", washing: "กำลังซัก", ready: "พร้อมส่ง", delivering: "กำลังจัดส่ง", completed: "เสร็จสิ้น", cancelled: "ยกเลิก" };
        const statusColor: Record<string, number> = { completed: 0x10B981, cancelled: 0xEF4444, accepted: 0x1257FF, washing: 0x8B5CF6, ready: 0xF59E0B, delivering: 0x06B6D4 };
        const statusTH = statusNameTH[data.status] || data.status;

        embed = {
          title: `${statusEmoji[data.status] || "📋"} สถานะอัพเดท`,
          description: `ออเดอร์ **${data.order_number || data.id.slice(0, 8)}** เปลี่ยนสถานะเป็น **${statusTH}**`,
          color: statusColor[data.status] || 0x1257FF,
          fields: [
            { name: "ชื่อลูกค้า", value: data.contact_name || "-", inline: true },
            { name: "เบอร์โทร", value: data.contact_phone || "-", inline: true },
          ],
          timestamp: new Date().toISOString(),
          footer: { text: "MASAKDI Admin System" },
        };
        break;

      case "new_report":
        const categoryEmoji: Record<string, string> = { delivery: "🚚", payment: "💰", quality: "⭐", system: "⚙️" };
        embed = {
          title: `⚠️ รีพอร์ตใหม่ - ${categoryEmoji[data.category] || "📋"} ${data.category}`,
          color: 0xF59E0B,
          fields: [
            { name: "เบอร์โทร", value: data.contact_phone || "-", inline: true },
            { name: "รายละเอียด", value: data.detail || "-", inline: false },
          ],
          timestamp: new Date().toISOString(),
          footer: { text: "MASAKDI Admin System" },
        };
        if (data.image_urls && data.image_urls.length > 0) {
          embed.fields.push({ name: "🖼️ รูปภาพแนบมา", value: data.image_urls.map((url: string) => `[คลิกดูรูป](${url})`).join("\n"), inline: false });
        }
        break;

      case "order_cancelled":
        embed = {
          title: "❌ ลูกค้ายกเลิกออเดอร์",
          color: 0xEF4444,
          description: `ออเดอร์ **${data.order_number || data.id.slice(0, 8)}** ถูกยกเลิกโดยลูกค้า`,
          fields: [
            { name: "👤 ชื่อลูกค้า", value: data.contact_name || "-", inline: true },
            { name: "📞 เบอร์โทร", value: data.contact_phone || "-", inline: true },
          ],
          timestamp: new Date().toISOString(),
          footer: { text: "MASAKDI Admin System" },
        };
        break;

      default:
        return { error: "Invalid notification type" };
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [embed],
        username: "MASAKDI Bot",
      }),
    });

    if (!response.ok) {
      throw new Error(`Discord API error: ${response.status}`);
    }

    return { success: true };
  } catch (error: any) {
    console.error("❌ sendDiscordNotification error:", error);
    return { error: error.message };
  }
}
