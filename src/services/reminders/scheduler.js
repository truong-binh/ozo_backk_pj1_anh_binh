// Lịch chạy nhắc việc trong tiến trình: 8–17h giờ VN, mỗi giờ đúng 1 lần.
// Kiểm mỗi phút cho đơn giản/chống trôi giờ; dùng khoá theo (ngày+giờ VN) để
// đảm bảo mỗi giờ chỉ chạy 1 lần dù kiểm nhiều lần.

const { remindersEnabled } = require('../../config/env');
const { isLarkConfigured } = require('../lark/larkClient');
const { runReminders } = require('./reminderService');
const { sendDailyReport } = require('./reportService');

const TZ = 'Asia/Ho_Chi_Minh';
const START_HOUR = 8;
const END_HOUR = 17; // bao gồm 17h -> chạy 8,9,...,17 (10 lượt/ngày)
const REPORT_HOUR = 9; // báo cáo nhóm mỗi 9h sáng

let lastRunKey = null;    // nhắc PIC theo giờ
let lastReportKey = null; // báo cáo nhóm theo ngày

function vnHour() {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(new Date()),
  );
}

function vnHourKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).format(new Date());
}

function vnDateKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

async function tick() {
  try {
    const h = vnHour();

    // 1) Báo cáo tiến độ vào nhóm Lark — mỗi ngày 1 lần lúc 9h sáng.
    if (h === REPORT_HOUR) {
      const dk = vnDateKey();
      if (dk !== lastReportKey) {
        lastReportKey = dk;
        const rr = await sendDailyReport();
        console.log(`[report] ${dk} ->`, JSON.stringify(rr.sentTo || rr.error || rr.counts));
      }
    }

    // 2) Nhắc việc cho PIC (DM) — 8–17h, mỗi giờ 1 lần. Chỉ còn due_soon/overdue;
    //    'việc mới giao' đã chuyển sang gửi ngay khi phân PIC (notifyAssignment).
    if (h >= START_HOUR && h <= END_HOUR) {
      const key = vnHourKey();
      if (key !== lastRunKey) {
        lastRunKey = key;
        const res = await runReminders();
        console.log(`[reminders] ${key} ->`, JSON.stringify(res));
      }
    }
  } catch (err) {
    console.error('[scheduler] tick lỗi:', err.message);
  }
}

function startReminderScheduler() {
  if (!remindersEnabled) {
    console.log('[reminders] tắt (REMINDERS_ENABLED=false)');
    return;
  }
  if (!isLarkConfigured) {
    console.log('[reminders] chưa cấu hình Lark -> không bật nhắc việc');
    return;
  }
  // Chạy thử ngay khi khởi động (nếu đang trong khung giờ). Lần đầu bảng rỗng sẽ
  // chỉ ghi nhận hiện trạng, không gửi.
  tick();
  const now = new Date();
  const msToNextMinute = 60000 - (now.getSeconds() * 1000 + now.getMilliseconds());
  setTimeout(() => {
    tick();
    setInterval(tick, 60000);
  }, msToNextMinute);
  console.log('[reminders] scheduler bật — quá hạn/sắp hạn 8–17h/giờ + báo cáo nhóm 9h sáng (giờ VN); việc mới giao gửi ngay khi phân PIC');
}

module.exports = { startReminderScheduler };
