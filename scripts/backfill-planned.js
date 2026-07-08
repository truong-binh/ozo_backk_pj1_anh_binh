// Điền planned_date (ngày dự kiến cố định) cho các dự án ĐÃ CÓ trước khi thêm cột.
// Chạy 1 lần sau khi đã chạy sql/planned-date.sql:  node scripts/backfill-planned.js
// Chỉ điền ô đang trống -> không ghi đè mốc đã cố định.
const { getSupabaseClient } = require('../src/config/supabaseClient');
const { computeAllDates, isoLocal } = require('../src/utils/datePlanner');

(async () => {
  const supabase = getSupabaseClient();
  const { data: projects, error } = await supabase.from('projects').select('*');
  if (error) throw error;

  let totalSet = 0;
  for (const p of projects || []) {
    const { data: nodes, error: e2 } = await supabase
      .from('project_nodes')
      .select('id,node_id,after,duration,status,planned_date')
      .eq('project_id', p.id);
    if (e2) throw e2;

    // Baseline: bỏ qua ngày thực tế để có kế hoạch gốc.
    const detail = {
      project: p,
      nodes: (nodes || []).map((n) => ({ ...n, actual_date: null })),
    };
    const dates = computeAllDates(detail);

    let set = 0;
    for (const n of nodes || []) {
      if (n.planned_date) continue; // giữ mốc đã cố định
      const d = dates[n.node_id];
      const planned = d ? isoLocal(d.due) : null;
      if (planned) {
        const { error: e3 } = await supabase
          .from('project_nodes')
          .update({ planned_date: planned })
          .eq('id', n.id);
        if (e3) throw e3;
        set += 1;
      }
    }
    totalSet += set;
    console.log(`${p.code}: điền ${set} bước`);
  }
  console.log(`Xong. Tổng ${totalSet} bước được chốt ngày dự kiến.`);
})().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
