// ── 약천재 Service Worker ─────────────────────────────────
const SW_VERSION = 'pillgenius-sw-v1';
const alarmTimers = {};

// ── 설치 & 활성화 ─────────────────────────────────────────
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

// ── 앱에서 메시지 수신 ────────────────────────────────────
self.addEventListener('message', event => {
  const { type, alarms } = event.data || {};
  if (type === 'SCHEDULE_ALARMS') {
    clearAllTimers();
    scheduleAlarms(alarms || []);
  }
  if (type === 'CLEAR_ALARMS') {
    clearAllTimers();
  }
});

// ── 알람 스케줄링 ─────────────────────────────────────────
function clearAllTimers() {
  Object.keys(alarmTimers).forEach(id => {
    clearTimeout(alarmTimers[id]);
    delete alarmTimers[id];
  });
}

function scheduleAlarms(alarms) {
  alarms.filter(a => a.on).forEach(alarm => {
    scheduleOne(alarm);
  });
}

function scheduleOne(alarm) {
  const [h, m] = alarm.time.split(':').map(Number);
  const now = new Date();
  const next = new Date();
  next.setHours(h, m, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  const delay = next - now;

  alarmTimers[alarm.id] = setTimeout(async () => {
    // 알림 표시
    await self.registration.showNotification('💊 약천재 복약 알림', {
      body: `${alarm.label || '복약 시간'}이에요! 약 챙기는 거 잊지 마세요 😊`,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `alarm-${alarm.id}`,
      renotify: true,
      vibrate: [200, 100, 200],
      actions: [
        { action: 'open', title: '약천재 열기' },
        { action: 'dismiss', title: '확인' }
      ],
      data: { alarmId: alarm.id, url: '/' }
    });

    // 다음날 같은 시각 재스케줄
    const updated = { ...alarm };
    setTimeout(() => scheduleOne(updated), 2000);
  }, delay);
}

// ── 알림 클릭 처리 ───────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // 이미 열린 탭이 있으면 포커스
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // 없으면 새 탭 열기
      return clients.openWindow('/');
    })
  );
});

// ── 푸시 수신 (향후 서버 푸시 연동 대비) ─────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || '💊 약천재', {
      body: data.body || '복약 시간이에요!',
      icon: '/icon-192.png',
      tag: data.tag || 'push-alarm',
    })
  );
});
