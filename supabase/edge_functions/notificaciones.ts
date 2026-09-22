import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

serve(async (req) => {
  try {
    const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

    const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
    
    let payload = { action: 'check_alarms' };
    try { payload = await req.json(); } catch(e) {}
    
    const sendTelegram = async (text: string) => {
      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CHAT_ID, text: text, parse_mode: 'HTML' })
      });
      if (!response.ok) {
        console.error("⚠️ Error de Telegram:", await response.json());
      }
    };

    const now = Date.now();
    const today = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Mexico_City"}));
    const todayStr = today.getFullYear() + "-" + String(today.getMonth()+1).padStart(2,'0') + "-" + String(today.getDate()).padStart(2,'0');
    
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.getFullYear() + "-" + String(nextWeek.getMonth()+1).padStart(2,'0') + "-" + String(nextWeek.getDate()).padStart(2,'0');

    // 🛠️ LA SOLUCIÓN: Función inteligente para limpiar las fechas de Supabase
    const parseDateMX = (dbDate: string) => {
        if (!dbDate) return new Date(0);
        let d = dbDate.replace(' ', 'T');
        // Si no tiene los segundos, se los agregamos. Si ya los tiene, lo dejamos en paz.
        if (d.length === 16) d += ':00'; 
        // Agregamos la zona horaria de México
        if (!d.includes('-06:00')) d += '-06:00';
        return new Date(d);
    };

    if (payload.action === 'daily_digest') {
       // --- HORARIO ESCOLAR (M215 - C206) ---
       const schedule: Record<number, string> = {
         1: "🏫 <b>Clases de hoy (Lunes):</b>\n• 14:00 - 15:40: Habilidades Gerenciales\n• 17:20 - 19:00: Cinemática y Dinámica de Robots\n• 19:00 - 20:40: Sistemas Embebidos\n",
         2: "🏫 <b>Clases de hoy (Martes):</b>\n• 14:00 - 15:40: Instrumentación Virtual\n• 15:40 - 17:20: Análisis de Mecanismos\n• 17:20 - 19:00: Tutoría\n• 19:00 - 20:40: Cinemática y Dinámica de Robots\n",
         3: "🏫 <b>Clases de hoy (Miércoles):</b>\n• 14:00 - 15:40: Habilidades Gerenciales\n• 17:20 - 18:10: Análisis de Mecanismos\n• 18:10 - 19:00: Sistemas Embebidos\n• 19:00 - 20:40: Cinemática y Dinámica de Robots\n",
         4: "🏫 <b>Clases de hoy (Jueves):</b>\n• 15:40 - 17:20: Instrumentación Virtual\n• 17:20 - 19:00: Modelado y Simulación de Sistemas\n• 19:00 - 20:40: Análisis de Mecanismos\n",
         5: "🏫 <b>Clases de hoy (Viernes):</b>\n• 14:00 - 15:40: Instrumentación Virtual\n• 17:20 - 19:00: Modelado y Simulación de Sistemas\n• 19:00 - 20:40: Sistemas Embebidos\n",
         6: "🎉 <b>¡Es Sábado! No hay clases.</b>\n",
         0: "🎉 <b>¡Es Domingo! No hay clases.</b>\n"
       };
       const dayOfWeek = today.getDay();
       const todaysClasses = schedule[dayOfWeek];

       const { data: exams } = await supabase.from('exams').select('*').gte('exam_date', todayStr).lte('exam_date', nextWeekStr).order('exam_date');
       const { data: tasks } = await supabase.from('tasks').select('*').eq('is_done', false).like('due_date', `%${todayStr}%`);
       const { data: reminders } = await supabase.from('reminders').select('*').eq('is_active', true).like('remind_at', `%${todayStr}%`);
       
       let msg = `🌅 <b>¡Buenos días! Tu resumen para hoy (${todayStr}):</b>\n\n`;
       if (exams && exams.length > 0) {
         msg += `🚨 <b>¡ALERTA DE EXÁMENES PRÓXIMOS!</b> 🚨\n`;
         exams.forEach(e => msg += `• <b>${e.title}</b> (${e.exam_date})\n`);
         msg += `\n`;
       }
       msg += todaysClasses + `\n`;
       msg += `📋 <b>Tareas de hoy:</b>\n`;
       if (tasks && tasks.length > 0) {
           tasks.forEach(t => {
               const materiaTag = t.materia ? ` [${t.materia}]` : '';
               msg += `• ${t.title}${materiaTag}\n`;
           });
       } else msg += `• Ninguna\n`;
       
       msg += `\n⏰ <b>Recordatorios:</b>\n`;
       if (reminders && reminders.length > 0) reminders.forEach(r => msg += `• ${r.text} (${r.remind_at})\n`);
       else msg += `• Ninguno\n`;
       
       await sendTelegram(msg);

    } else {
       // --- REVISIÓN MINUTO A MINUTO (AHORA SÍ FUNCIONA) ---
       const { data: alarms } = await supabase.from('alarms').select('*').eq('notified', false);
       if (alarms) {
         for (const a of alarms) {
           const aDate = parseDateMX(a.alarm_at);
           const diffMins = (aDate.getTime() - now) / (1000 * 60);
           if (diffMins <= 1 && diffMins > -10) {
             await sendTelegram(`🚨 <b>ALARMA:</b> ${a.text}`);
             await supabase.from('alarms').update({ notified: true }).eq('id', a.id);
           }
         }
       }

       const { data: tasks } = await supabase.from('tasks').select('*').eq('is_done', false).eq('notified_24h', false);
       if (tasks) {
         for (const t of tasks) {
           const tDate = parseDateMX(t.due_date);
           const diffHours = (tDate.getTime() - now) / (1000 * 60 * 60);
           if (diffHours > 0 && diffHours <= 24) {
             const materiaTag = t.materia ? ` [${t.materia}]` : '';
             await sendTelegram(`🔔 <b>Tarea para mañana:</b> ${t.title}${materiaTag} (Programada: ${t.due_date})`);
             await supabase.from('tasks').update({ notified_24h: true }).eq('id', t.id);
           }
         }
       }
       
       const { data: reminders } = await supabase.from('reminders').select('*').eq('is_active', true).eq('notified_30m', false);
       if (reminders) {
         for (const r of reminders) {
           const rDate = parseDateMX(r.remind_at);
           const diffMins = (rDate.getTime() - now) / (1000 * 60);
           if (diffMins > 0 && diffMins <= 30) {
             await sendTelegram(`⚠️ <b>Recordatorio en 30 min:</b> ${r.text}`);
             await supabase.from('reminders').update({ notified_30m: true }).eq('id', r.id);
           }
         }
       }
    }
    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error fatal:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
})