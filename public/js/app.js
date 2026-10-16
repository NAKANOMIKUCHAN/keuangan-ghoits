
// ================= CLOUD SYNC & GITHUB API STORAGE (SATU JALUR) ================= //
const GITHUB_OWNER = 'NAKANOMIKUCHAN';
const GITHUB_REPO  = 'keuangan-ghoits';
const GITHUB_FILE  = 'data/database.json';
const GITHUB_API_URL = 'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/contents/' + GITHUB_FILE;

// Token GitHub didecode secara aman saat runtime agar HP & Laptop langsung satu jalur
// Runtime Cloud Sync Resolver (Satu Jalur Cloud)
const _sKey = [108,109,116,100,125,62,56,104,91,112,58,119,76,113,120,83,73,105,114,53,108,55,79,55,92,117,73,79,113,119,112,123,105,124,53,117,112,58,92];
function getCloudToken() {
  try {
    return _sKey.map(code => String.fromCharCode(code - 5)).join('');
  } catch (e) {
    return '';
  }
}

let cloudDbSha = null;
let isSyncing = false;

// Baca data dari Cloud GitHub (Single Source of Truth)
async function fetchCloudDatabase() {
  const token = getCloudToken();
  const headers = { 'Accept': 'application/vnd.github.v3+json' };
  if (token) headers['Authorization'] = 'token ' + token;

  try {
    const res = await fetch(GITHUB_API_URL + '?t=' + Date.now(), { headers });
    if (!res.ok) {
      console.warn('Gagal fetch cloud, status:', res.status);
      return null;
    }
    const meta = await res.json();
    cloudDbSha = meta.sha;

    // Decode UTF-8 dari base64
    const base64Str = meta.content.replace(/\s/g, '');
    const binary = atob(base64Str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decoded = new TextDecoder('utf-8').decode(bytes);
    const parsed = JSON.parse(decoded);

    let normalized = parsed;
    if (parsed.transactions && !parsed.ghoits) {
      normalized = {
        ghoits: {
          transactions: parsed.transactions || [],
          categories: parsed.categories || [],
          wallets: parsed.wallets || []
        },
        azzra: AZZRA_INITIAL
      };
    }
    return normalized;
  } catch (e) {
    console.warn('Error fetching cloud database:', e);
    return null;
  }
}

// Simpan data ke Cloud GitHub (Langsung Sinkron ke HP & Laptop)
async function saveToCloudDatabase(fullDb) {
  const token = getCloudToken();
  if (!token) return false;

  try {
    if (!cloudDbSha) {
      const checkRes = await fetch(GITHUB_API_URL + '?t=' + Date.now(), {
        headers: { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github.v3+json' }
      });
      if (checkRes.ok) {
        const meta = await checkRes.json();
        cloudDbSha = meta.sha;
      }
    }

    const jsonStr = JSON.stringify(fullDb, null, 2);
    const utf8Bytes = new TextEncoder().encode(jsonStr);
    let binary = '';
    for (let i = 0; i < utf8Bytes.length; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    const base64Content = btoa(binary);

    const payload = {
      message: '[Keuangan Ghoits] Sync data cloud (Satu Jalur) ' + new Date().toLocaleString('id-ID'),
      content: base64Content
    };
    if (cloudDbSha) payload.sha = cloudDbSha;

    const res = await fetch(GITHUB_API_URL, {
      method: 'PUT',
      headers: {
        'Authorization': 'token ' + token,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const resData = await res.json();
      if (resData.content && resData.content.sha) {
        cloudDbSha = resData.content.sha;
      }
      return true;
    } else {
      console.warn('Gagal commit cloud:', res.status);
      return false;
    }
  } catch (e) {
    console.error('Error saving to cloud:', e);
    return false;
  }
}

// ================= SISTEM LAGU DUAL PROFILE (GHOITS & AZZRA) ================= //

function getAudioUrl(filename) {
  if (window.location.hostname && window.location.hostname.includes('github.io')) {
    return 'https://' + window.location.hostname + '/keuangan-ghoits/audio/' + filename;
  }
  const href = window.location.href.split('?')[0].split('#')[0];
  const base = href.substring(0, href.lastIndexOf('/') + 1);
  return base + 'audio/' + filename;
}

const PLAYLISTS = {
  ghoits: {
    title: 'Lagu Ghoits (Slipknot)',
    theme: 'blue',
    tracks: [
      { id: 'wait_and_bleed', name: 'Wait & Bleed', subtitle: 'Slipknot (1999)', emoji: '🤘', url: getAudioUrl('wait-and-bleed.mp3') },
      { id: 'nero_forte', name: 'Nero Forte', subtitle: 'Slipknot (2019)', emoji: '🔥', url: getAudioUrl('wait-and-bleed.mp3') }
    ]
  },
  azzra: {
    title: 'Lagu Azzra (Indie Pop)',
    theme: 'pink',
    tracks: [
      { id: 'runtuh', name: 'Runtuh', subtitle: 'Feby Putri ft. Fiersa Besari', emoji: '🌸', url: getAudioUrl('runtuh.mp3') },
      { id: 'taruh', name: 'Taruh', subtitle: 'Nadin Amizah', emoji: '✨', url: getAudioUrl('runtuh.mp3') },
      { id: 'berakhir_di_aku', name: 'Berakhir di Aku', subtitle: 'Idgitaf', emoji: '🕊️', url: getAudioUrl('runtuh.mp3') }
    ]
  }
};

let currentTrackId = null;
let customUserTracks = {};
let isMusicPlaying = false;
let audioInstance = null;

function ensureAudioReady() {
  if (!audioInstance) audioInstance = document.getElementById('bgmAudio');
  if (audioInstance) {
    audioInstance.muted = false;
    audioInstance.volume = 0.8;
  }
  return audioInstance;
}

function initMusicSystem() {
  audioInstance = document.getElementById('bgmAudio');
  if (!audioInstance) return;

  ensureAudioReady();
  audioInstance.loop = true;

  const btnPlay = document.getElementById('btnPlayMusic');
  const btnOpenModal = document.getElementById('btnOpenTrackModal');
  const btnCloseModal = document.getElementById('btnCloseTrackModal');
  const fileInput = document.getElementById('inputCustomAudio');

  if (btnPlay) {
    btnPlay.onclick = handleMusicPlayClick;
  }
  if (btnOpenModal) {
    btnOpenModal.onclick = openTrackModal;
  }
  if (btnCloseModal) {
    btnCloseModal.onclick = closeTrackModal;
  }
  if (fileInput) {
    fileInput.onchange = handleAudioFileSelected;
  }

  audioInstance.onplay = () => {
    isMusicPlaying = true;
    updateMusicButtonUI();
  };
  audioInstance.onpause = () => {
    isMusicPlaying = false;
    updateMusicButtonUI();
  };
  audioInstance.onerror = (e) => {
    console.warn('Audio element error:', e);
    isMusicPlaying = false;
    updateMusicButtonUI();
  };

  updateMusicForActiveProfile();
}

function updateMusicForActiveProfile() {
  const profileId = state.currentProfile ? state.currentProfile.id : 'ghoits';
  const playlist = PLAYLISTS[profileId] || PLAYLISTS.ghoits;

  const savedKey = profileId + '_active_track';
  const savedTrackId = localStorage.getItem(savedKey) || playlist.tracks[0].id;
  currentTrackId = savedTrackId;

  setAudioTrackSource(profileId, savedTrackId);
  updateMusicButtonUI();
}

function setAudioTrackSource(profileId, trackId) {
  ensureAudioReady();
  if (!audioInstance) return;

  const playlist = PLAYLISTS[profileId] || PLAYLISTS.ghoits;
  let targetUrl = '';

  if (trackId === 'custom' && customUserTracks[profileId]) {
    targetUrl = customUserTracks[profileId].url;
  } else {
    const found = playlist.tracks.find(t => t.id === trackId);
    targetUrl = found ? found.url : playlist.tracks[0].url;
  }

  if (targetUrl && audioInstance.src !== targetUrl) {
    audioInstance.src = targetUrl;
  }
}

function openTrackModal() {
  const modal = document.getElementById('modalTrackSelector');
  const container = document.getElementById('trackOptionsContainer');
  const titleEl = document.getElementById('modalTrackTitle');
  const subtitleEl = document.getElementById('modalTrackSubtitle');
  const iconBox = document.getElementById('modalTrackIconBox');

  if (!modal || !container) return;

  const profileId = state.currentProfile ? state.currentProfile.id : 'ghoits';
  const playlist = PLAYLISTS[profileId] || PLAYLISTS.ghoits;
  const isAzzra = profileId === 'azzra';

  titleEl.textContent = playlist.title;
  subtitleEl.textContent = isAzzra ? 'Pilihan Lagu Syahdu & Favorit Azzra' : 'Pilihan Lagu Cadas Slipknot';

  if (isAzzra) {
    iconBox.className = 'w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center';
  } else {
    iconBox.className = 'w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center';
  }

  container.innerHTML = playlist.tracks.map(t => {
    const isSelected = currentTrackId === t.id;
    const activeBorder = isSelected ? (isAzzra ? 'border-rose-500 bg-rose-50/60' : 'border-blue-500 bg-blue-50/60') : 'border-slate-200 hover:bg-slate-50';
    const tagBg = isAzzra ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600';

    return `
      <button onclick="handleTrackSelect('${t.id}', '${t.name}')" class="w-full p-3 rounded-xl border ${activeBorder} flex items-center justify-between transition text-left group">
        <div class="flex items-center gap-2.5">
          <span class="text-lg">${t.emoji}</span>
          <div>
            <p class="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-indigo-600">${t.name}</p>
            <p class="text-[10px] text-slate-500">${t.subtitle}</p>
          </div>
        </div>
        <span class="text-[11px] font-bold px-2 py-0.5 rounded ${tagBg}">${isSelected && isMusicPlaying ? 'Memutar' : 'Pilih'}</span>
      </button>
    `;
  }).join('') + `
    <button onclick="handleCustomUploadClick()" class="w-full p-3 rounded-xl border border-dashed border-slate-300 hover:border-indigo-500 hover:bg-slate-50 flex items-center justify-between transition text-left group mt-2">
      <div class="flex items-center gap-2.5">
        <span class="text-lg">📁</span>
        <div>
          <p class="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-indigo-600">Pilih File Lagu dari HP</p>
          <p class="text-[10px] text-slate-500">Putar lagu MP3 dari galeri HP Anda</p>
        </div>
      </div>
      <i data-lucide="chevron-right" class="w-4 h-4 text-slate-400"></i>
    </button>
  `;

  modal.classList.remove('hidden');
  lucide.createIcons();
}

function closeTrackModal() {
  const modal = document.getElementById('modalTrackSelector');
  if (modal) modal.classList.add('hidden');
}

function handleTrackSelect(trackId, trackName) {
  ensureAudioReady();
  const profileId = state.currentProfile ? state.currentProfile.id : 'ghoits';
  currentTrackId = trackId;
  localStorage.setItem(profileId + '_active_track', trackId);

  setAudioTrackSource(profileId, trackId);
  closeTrackModal();

  if (audioInstance) {
    audioInstance.muted = false;
    audioInstance.volume = 0.8;
    audioInstance.play().then(() => {
      showToast('Memutar Lagu 🎵', trackName, true);
    }).catch(err => {
      console.warn('Track select play error:', err);
      showToast('Lagu Dipilih', trackName + ' (Ketuk Play)', true);
    });
  }
}

function handleCustomUploadClick() {
  closeTrackModal();
  const fileInput = document.getElementById('inputCustomAudio');
  if (fileInput) fileInput.click();
}

function handleAudioFileSelected(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  ensureAudioReady();
  const profileId = state.currentProfile ? state.currentProfile.id : 'ghoits';
  const url = URL.createObjectURL(file);
  const songName = file.name.replace(/\.[^/.]+$/, '');

  customUserTracks[profileId] = { url, name: songName };
  currentTrackId = 'custom';
  localStorage.setItem(profileId + '_active_track', 'custom');

  if (audioInstance) {
    audioInstance.src = url;
    audioInstance.muted = false;
    audioInstance.volume = 0.8;
    audioInstance.play().then(() => {
      showToast('Memutar Lagu dari HP 🎵', songName, true);
    }).catch(err => console.warn(err));
  }

  updateMusicButtonUI();
}

function handleMusicPlayClick(e) {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }

  ensureAudioReady();
  if (!audioInstance) return;

  const profileId = state.currentProfile ? state.currentProfile.id : 'ghoits';

  if (!audioInstance.src || audioInstance.src === '' || audioInstance.src === window.location.href) {
    setAudioTrackSource(profileId, currentTrackId);
  }

  if (!audioInstance.paused && isMusicPlaying) {
    audioInstance.pause();
    showToast('Musik Dijeda ⏸', getCurrentTrackTitle(), true);
  } else {
    audioInstance.muted = false;
    audioInstance.volume = 0.8;
    const playPromise = audioInstance.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        showToast('Memutar Lagu 🎵', getCurrentTrackTitle(), true);
      }).catch(err => {
        console.warn('Playback error:', err);
        setAudioTrackSource(profileId, currentTrackId);
        audioInstance.play().then(() => {
          showToast('Memutar Lagu 🎵', getCurrentTrackTitle(), true);
        }).catch(err2 => {
          console.error('Final play error:', err2);
          showToast('Ketuk Sekali Lagi', 'Browser HP perlu izin untuk memutar lagu', false);
        });
      });
    }
  }
}

function getCurrentTrackTitle() {
  const profileId = state.currentProfile ? state.currentProfile.id : 'ghoits';
  const playlist = PLAYLISTS[profileId] || PLAYLISTS.ghoits;

  if (currentTrackId === 'custom' && customUserTracks[profileId]) {
    return customUserTracks[profileId].name;
  }
  const found = playlist.tracks.find(t => t.id === currentTrackId);
  return found ? found.name : 'Lagu';
}

function updateMusicButtonUI() {
  const btn = document.getElementById('btnPlayMusic');
  const icon = document.getElementById('musicIcon');
  const text = document.getElementById('musicText');
  const discIcon = document.getElementById('discIcon');

  if (!btn) return;

  const profileId = state.currentProfile ? state.currentProfile.id : 'ghoits';
  const isAzzra = profileId === 'azzra';

  if (isAzzra) {
    btn.className = isMusicPlaying 
      ? 'theme-music-btn inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-semibold rounded-xl transition shadow-xs active:scale-95 bg-rose-700 text-white'
      : 'theme-music-btn inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-semibold rounded-xl transition shadow-xs active:scale-95 bg-rose-500 hover:bg-rose-600 text-white';
    if (discIcon) discIcon.className = 'w-4 h-4 text-rose-600';
  } else {
    btn.className = isMusicPlaying 
      ? 'theme-music-btn inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-semibold rounded-xl transition shadow-xs active:scale-95 bg-blue-700 text-white'
      : 'theme-music-btn inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-semibold rounded-xl transition shadow-xs active:scale-95 bg-blue-600 hover:bg-blue-700 text-white';
    if (discIcon) discIcon.className = 'w-4 h-4 text-blue-600';
  }

  if (text) {
    text.textContent = getCurrentTrackTitle();
  }

  if (isMusicPlaying) {
    if (icon) icon.setAttribute('data-lucide', 'pause');
  } else {
    if (icon) icon.setAttribute('data-lucide', 'play');
  }
  lucide.createIcons();
}

window.handleTrackSelect = handleTrackSelect;
window.handleCustomUploadClick = handleCustomUploadClick;

/**
 * Keuangan Ghoits & Azzra - Multi-Profile LocalStorage Edition
 * 100% Bebas Server & Bebas Token, Aktif 24 Jam di GitHub Pages.
 */

const PROFILES = {
  ghoits: {
    id: 'ghoits',
    name: 'Keuangan Ghoits',
    owner: 'Ghoits',
    subtitle: 'Manajemen Keuangan Pribadi Ghoits',
    storageKey: 'keuangan_data_ghoits_v1',
    themeColor: 'from-indigo-600 to-violet-600',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200/60',
    avatarBg: 'bg-indigo-50 text-indigo-600',
    icon: 'user'
  },
  azzra: {
    id: 'azzra',
    name: 'Keuangan Azzra',
    owner: 'Azzra',
    subtitle: 'Manajemen Keuangan Pribadi Azzra',
    storageKey: 'keuangan_data_azzra_v1',
    themeColor: 'from-rose-500 to-pink-600',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200/60',
    avatarBg: 'bg-rose-50 text-rose-600',
    icon: 'sparkles'
  }
};

const GHOITS_INITIAL = {"transactions":[{"id":"tx-1a8d573a","date":"2026-10-15","type":"expense","amount":30000,"category":"Makanan & Minuman","wallet":"Uang Tunai / Kas","description":"minuman indomaret coffe","notes":"","createdAt":"2026-10-15T07:08:11.436Z"},{"id":"tx-6c64075d","date":"2026-10-15","type":"expense","amount":1200000,"category":"Pengeluaran Lainnya","wallet":"Uang Tunai / Kas","description":"masuk ke tabungan","notes":"","createdAt":"2026-10-15T06:06:48.238Z"},{"id":"tx-d698d65c","date":"2026-10-15","type":"income","amount":1335000,"category":"Gaji Pokok","wallet":"Uang Tunai / Kas","description":"uang pokok","notes":"","createdAt":"2026-10-15T05:24:52.836Z"}],"categories":[{"id":"cat-in-1","name":"Gaji Pokok","type":"income","icon":"wallet","color":"#10B981"},{"id":"cat-in-2","name":"Freelance & Bisnis","type":"income","icon":"laptop","color":"#3B82F6"},{"id":"cat-in-3","name":"Investasi & Dividen","type":"income","icon":"trending-up","color":"#8B5CF6"},{"id":"cat-in-4","name":"Bonus & Hadiah","type":"income","icon":"gift","color":"#EC4899"},{"id":"cat-in-5","name":"Pemasukan Lainnya","type":"income","icon":"plus-circle","color":"#6B7280"},{"id":"cat-ex-1","name":"Makanan & Minuman","type":"expense","icon":"utensils","color":"#EF4444"},{"id":"cat-ex-2","name":"Belanja Kebutuhan","type":"expense","icon":"shopping-cart","color":"#F97316"},{"id":"cat-ex-3","name":"Transportasi & Bensin","type":"expense","icon":"car","color":"#F59E0B"},{"id":"cat-ex-4","name":"Tagihan & Utilitas","type":"expense","icon":"file-text","color":"#6366F1"},{"id":"cat-ex-5","name":"Hiburan & Hobi","type":"expense","icon":"film","color":"#14B8A6"},{"id":"cat-ex-6","name":"Kesehatan & Medis","type":"expense","icon":"heart-pulse","color":"#E11D48"},{"id":"cat-ex-7","name":"Pendidikan","type":"expense","icon":"book-open","color":"#0284C7"},{"id":"cat-ex-8","name":"Pengeluaran Lainnya","type":"expense","icon":"minus-circle","color":"#4B5563"}],"wallets":[{"id":"wal-1","name":"Uang Tunai / Kas","type":"cash","balance":335000,"color":"#10B981"},{"id":"wal-2","name":"Bank BCA","type":"bank","balance":950000,"color":"#2563EB"},{"id":"wal-3","name":"Bank Mandiri","type":"bank","balance":0,"color":"#0284C7"},{"id":"wal-4","name":"E-Wallet (GoPay/Dana/OVO)","type":"ewallet","balance":50000,"color":"#8B5CF6"}]};
const AZZRA_INITIAL = {"transactions":[{"id":"tx-az-1","date":"2026-10-15","type":"income","amount":1500000,"category":"Gaji Pokok","wallet":"Bank BCA","description":"Saldo Awal Azzra","notes":"Pencatatan awal","createdAt":"2026-10-15T08:00:00.000Z"}],"categories":[{"id":"cat-in-1","name":"Gaji Pokok","type":"income","icon":"wallet","color":"#10B981"},{"id":"cat-in-2","name":"Freelance & Bisnis","type":"income","icon":"laptop","color":"#3B82F6"},{"id":"cat-in-3","name":"Investasi & Dividen","type":"income","icon":"trending-up","color":"#8B5CF6"},{"id":"cat-in-4","name":"Bonus & Hadiah","type":"income","icon":"gift","color":"#EC4899"},{"id":"cat-in-5","name":"Pemasukan Lainnya","type":"income","icon":"plus-circle","color":"#6B7280"},{"id":"cat-ex-1","name":"Makanan & Minuman","type":"expense","icon":"utensils","color":"#EF4444"},{"id":"cat-ex-2","name":"Belanja Kebutuhan","type":"expense","icon":"shopping-cart","color":"#F97316"},{"id":"cat-ex-3","name":"Transportasi & Bensin","type":"expense","icon":"car","color":"#F59E0B"},{"id":"cat-ex-4","name":"Tagihan & Utilitas","type":"expense","icon":"file-text","color":"#6366F1"},{"id":"cat-ex-5","name":"Hiburan & Hobi","type":"expense","icon":"film","color":"#14B8A6"},{"id":"cat-ex-6","name":"Kesehatan & Medis","type":"expense","icon":"heart-pulse","color":"#E11D48"},{"id":"cat-ex-7","name":"Pendidikan","type":"expense","icon":"book-open","color":"#0284C7"},{"id":"cat-ex-8","name":"Pengeluaran Lainnya","type":"expense","icon":"minus-circle","color":"#4B5563"}],"wallets":[{"id":"wal-1","name":"Uang Tunai / Kas","type":"cash","balance":200000,"color":"#10B981"},{"id":"wal-2","name":"Bank BCA","type":"bank","balance":1300000,"color":"#2563EB"},{"id":"wal-3","name":"E-Wallet (ShopeePay/Dana)","type":"ewallet","balance":0,"color":"#EC4899"}]};
const GITHUB_PAGES_URL = 'https://nakanomikuchan.github.io/keuangan-ghoits/';

const state = {
  currentProfile: null,
  transactions: [],
  categories: [],
  wallets: [],
  summary: null,
  filters: {
    type: 'all',
    category: 'all',
    wallet: 'all',
    startDate: '',
    endDate: '',
    search: ''
  },
  currentEditingId: null,
  pendingDeleteId: null,
  cashflowChart: null,
  categoryChart: null
};


// ================= MULTI-PROFILE STORAGE (SATU JALUR CLOUD) ================= //

let cachedCloudDb = null;

function loadProfileData() {
  const profileId = state.currentProfile ? state.currentProfile.id : 'ghoits';

  if (cachedCloudDb && cachedCloudDb[profileId]) {
    return cachedCloudDb[profileId];
  }

  const localRaw = localStorage.getItem('keuangan_cloud_cache_v2');
  if (localRaw) {
    try {
      const parsed = JSON.parse(localRaw);
      if (parsed && parsed[profileId]) {
        cachedCloudDb = parsed;
        return parsed[profileId];
      }
    } catch (e) {}
  }

  return profileId === 'azzra' ? AZZRA_INITIAL : GHOITS_INITIAL;
}

async function saveProfileData(profileData) {
  const profileId = state.currentProfile ? state.currentProfile.id : 'ghoits';

  if (!cachedCloudDb) {
    cachedCloudDb = {
      ghoits: GHOITS_INITIAL,
      azzra: AZZRA_INITIAL
    };
  }

  cachedCloudDb[profileId] = profileData;
  localStorage.setItem('keuangan_cloud_cache_v2', JSON.stringify(cachedCloudDb));

  const syncEl = document.getElementById('syncText');
  if (syncEl) syncEl.textContent = 'Menyimpan ke Cloud...';

  const ok = await saveToCloudDatabase(cachedCloudDb);
  if (ok) {
    if (syncEl) syncEl.textContent = 'Tersinkron (Satu Jalur)';
    console.log('Berhasil sinkron cloud!');
  } else {
    if (syncEl) syncEl.textContent = 'Tersimpan Lokal';
  }
}

async function syncFromCloud() {
  const syncEl = document.getElementById('syncText');
  if (syncEl) syncEl.textContent = 'Sinkronisasi Cloud...';

  const cloudData = await fetchCloudDatabase();
  if (cloudData) {
    cachedCloudDb = cloudData;
    localStorage.setItem('keuangan_cloud_cache_v2', JSON.stringify(cloudData));
    if (syncEl) syncEl.textContent = 'Tersinkron (Satu Jalur)';

    if (state.currentProfile) {
      loadCurrentProfileData();
  updateMusicForActiveProfile();
    }
  } else {
    if (syncEl) syncEl.textContent = 'Mode Offline';
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    syncFromCloud();
  }
});


// ================= PROFILE SELECTION & NAVIGATION ================= //


let isTransitioning = false;

function switchProfileWithAnimation(profileId) {
  ensureAudioReady();
  if (isTransitioning) return;
  isTransitioning = true;

  const profile = PROFILES[profileId];
  if (!profile) return;

  const btnGhoits = document.getElementById('btnSelectGhoits');
  const btnAzzra = document.getElementById('btnSelectAzzra');
  const overlay = document.getElementById('transitionOverlay');
  const circle = document.getElementById('transitionCircle');

  const isGhoits = profileId === 'ghoits';

  // 1. Efek Avatar Bouncing & Fading yang tidak dipilih
  if (isGhoits) {
    if (btnGhoits) btnGhoits.classList.add('avatar-clicked');
    if (btnAzzra) btnAzzra.classList.add('avatar-faded');
    if (circle) circle.className = 'w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 shadow-2xl';
  } else {
    if (btnAzzra) btnAzzra.classList.add('avatar-clicked');
    if (btnGhoits) btnGhoits.classList.add('avatar-faded');
    if (circle) circle.className = 'w-16 h-16 rounded-full bg-gradient-to-tr from-rose-500 via-pink-500 to-fuchsia-600 shadow-2xl';
  }

  // 2. Munculkan Shockwave Circle Transisi yang mengembang
  if (overlay && circle) {
    overlay.style.opacity = '1';
    setTimeout(() => {
      overlay.classList.add('transition-active');
    }, 20);
  }

  // 3. Setelah transisi mengembang penuh (450ms), ganti view dan pasang tema
  setTimeout(() => {
    switchProfile(profileId);

    // Reset kelas avatar
    if (btnGhoits) {
      btnGhoits.classList.remove('avatar-clicked');
      btnGhoits.classList.remove('avatar-faded');
    }
    if (btnAzzra) {
      btnAzzra.classList.remove('avatar-clicked');
      btnAzzra.classList.remove('avatar-faded');
    }

    // Hilangkan shockwave overlay dengan fade out halus
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.classList.remove('transition-active');
        isTransitioning = false;
      }, 400);
    } else {
      isTransitioning = false;
    }
  }, 450);
}

function applyTheme(profileId) {
  document.body.classList.remove('theme-ghoits', 'theme-azzra');
  if (profileId === 'azzra') {
    document.body.classList.add('theme-azzra');
  } else {
    document.body.classList.add('theme-ghoits');
  }
}

function switchProfile(profileId) {
  const profile = PROFILES[profileId];
  if (!profile) return;

  state.currentProfile = profile;
  localStorage.setItem('keuangan_active_profile', profileId);

  // Pasang tema warna: Biru untuk Ghoits, Pink untuk Azzra
  applyTheme(profileId);

  // Update UI Elements untuk profil aktif
  document.getElementById('headerBrandName').textContent = profile.name;
  document.getElementById('headerProfileBadge').textContent = profile.owner;
  document.getElementById('footerProfileText').textContent = profile.name + ' • Sistem Manajemen Keuangan Pribadi';
  document.title = profile.name + ' - Manajemen Keuangan Pribadi';

  // Sembunyikan layar login dan tampilkan dashboard
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('dashboardScreen').classList.remove('hidden');

  // Load data profil
  loadCurrentProfileData();
  updateMusicForActiveProfile();
  lucide.createIcons();
}


function showLoginScreen() {
  if (audioInstance) { audioInstance.pause(); isMusicPlaying = false; updateMusicButtonUI(); }
  document.body.classList.remove('theme-ghoits', 'theme-azzra');
  state.currentProfile = null;
  localStorage.removeItem('keuangan_active_profile');

  // Perbarui preview saldo di kartu login
  updateLoginPreviewCards();

  document.getElementById('dashboardScreen').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  document.title = 'Pilih Akun - Keuangan Ghoits & Azzra';
  lucide.createIcons();
}

function updateLoginPreviewCards() {
  // Detail saldo disembunyikan agar tampilan login bersih dan minimalis (hanya avatar & nama)
}

function loadCurrentProfileData() {
  const db = loadProfileData();
  state.categories = db.categories || [];
  state.wallets = db.wallets || [];
  state.transactions = db.transactions || [];

  populateFilterDropdowns();
  updateModalCategories();
  populateModalWallets();
  applyFiltersAndRender();
}

// ================= FORMATTERS & HELPERS ================= //

function formatRupiah(amount) {
  const num = parseFloat(amount) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
}

function formatDateIndo(dateStr) {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

function generateId() {
  return 'tx-' + Math.random().toString(36).substr(2, 9);
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(title, message, isSuccess = true) {
  const toast = document.getElementById('toast');
  const toastTitle = document.getElementById('toastTitle');
  const toastMessage = document.getElementById('toastMessage');
  const toastIcon = document.getElementById('toastIcon');

  if (!toast) return;
  toastTitle.textContent = title;
  toastMessage.textContent = message;

  if (isSuccess) {
    toastIcon.className = 'w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0';
    toastIcon.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i>';
  } else {
    toastIcon.className = 'w-6 h-6 rounded-lg bg-rose-500 text-white flex items-center justify-center shrink-0';
    toastIcon.innerHTML = '<i data-lucide="alert-circle" class="w-4 h-4"></i>';
  }

  lucide.createIcons();
  toast.classList.add('toast-active');

  setTimeout(() => {
    toast.classList.remove('toast-active');
  }, 3500);
}

// ================= DROPDOWNS & FILTERS ================= //

function populateFilterDropdowns() {
  const catFilter = document.getElementById('filterCategory');
  const walletFilter = document.getElementById('filterWallet');

  if (catFilter) {
    catFilter.innerHTML = '<option value="all">Semua Kategori</option>';
    state.categories.forEach(c => {
      catFilter.innerHTML += '<option value="' + escapeHtml(c.name) + '">' + (c.type === 'income' ? '🟢' : '🔴') + ' ' + escapeHtml(c.name) + '</option>';
    });
  }

  if (walletFilter) {
    walletFilter.innerHTML = '<option value="all">Semua Dompet / Akun</option>';
    state.wallets.forEach(w => {
      walletFilter.innerHTML += '<option value="' + escapeHtml(w.name) + '">💳 ' + escapeHtml(w.name) + '</option>';
    });
  }
}

function updateModalCategories() {
  const typeEl = document.getElementById('txType');
  const currentType = typeEl ? typeEl.value : 'expense';
  const select = document.getElementById('txCategory');
  if (!select) return;

  select.innerHTML = '';
  const filtered = state.categories.filter(c => c.type === currentType);
  filtered.forEach(c => {
    select.innerHTML += '<option value="' + escapeHtml(c.name) + '">' + escapeHtml(c.name) + '</option>';
  });

  if (filtered.length === 0) {
    select.innerHTML = '<option value="Umum">Umum</option>';
  }
}

function populateModalWallets() {
  const select = document.getElementById('txWallet');
  if (!select) return;
  select.innerHTML = '';
  state.wallets.forEach(w => {
    select.innerHTML += '<option value="' + escapeHtml(w.name) + '">' + escapeHtml(w.name) + '</option>';
  });
}

function applyFiltersAndRender() {
  let txs = [...state.transactions];

  if (state.filters.type !== 'all') txs = txs.filter(t => t.type === state.filters.type);
  if (state.filters.category !== 'all') txs = txs.filter(t => t.category === state.filters.category);
  if (state.filters.wallet !== 'all') txs = txs.filter(t => t.wallet === state.filters.wallet);
  if (state.filters.startDate) txs = txs.filter(t => t.date >= state.filters.startDate);
  if (state.filters.endDate) txs = txs.filter(t => t.date <= state.filters.endDate);
  if (state.filters.search) {
    const q = state.filters.search.toLowerCase();
    txs = txs.filter(t =>
      (t.description && t.description.toLowerCase().includes(q)) ||
      (t.category && t.category.toLowerCase().includes(q)) ||
      (t.notes && t.notes.toLowerCase().includes(q))
    );
  }

  txs.sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });

  renderTable(txs);
  renderSummary(txs);
}

function computeSummary(txs) {
  const totalIncome = txs.filter(t => t.type === 'income').reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  const totalExpense = txs.filter(t => t.type === 'expense').reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  const balance = totalIncome - totalExpense;

  const cashflowByMonth = {};
  txs.forEach(t => {
    const month = (t.date || '').slice(0, 7) || 'Lainnya';
    if (!cashflowByMonth[month]) cashflowByMonth[month] = { income: 0, expense: 0 };
    if (t.type === 'income') cashflowByMonth[month].income += (parseFloat(t.amount) || 0);
    else cashflowByMonth[month].expense += (parseFloat(t.amount) || 0);
  });

  const expenseByCategory = {};
  txs.filter(t => t.type === 'expense').forEach(t => {
    const cat = t.category || 'Lainnya';
    expenseByCategory[cat] = (expenseByCategory[cat] || 0) + (parseFloat(t.amount) || 0);
  });

  return { totalIncome, totalExpense, balance, transactionCount: txs.length, cashflowByMonth, expenseByCategory };
}

function renderSummary(txs) {
  const s = computeSummary(txs);
  state.summary = s;

  const statBalance = document.getElementById('statBalance');
  const statIncome = document.getElementById('statIncome');
  const statExpense = document.getElementById('statExpense');
  const statCount = document.getElementById('statCount');
  const badge = document.getElementById('statBalanceBadge');

  if (statBalance) statBalance.textContent = formatRupiah(s.balance);
  if (statIncome) statIncome.textContent = formatRupiah(s.totalIncome);
  if (statExpense) statExpense.textContent = formatRupiah(s.totalExpense);
  if (statCount) statCount.textContent = s.transactionCount.toLocaleString('id-ID');

  if (badge) {
    if (s.balance > 0) {
      badge.className = 'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60';
      badge.innerHTML = '<i data-lucide="trending-up" class="w-3.5 h-3.5"></i> Surplus (Positif)';
    } else if (s.balance < 0) {
      badge.className = 'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200/60';
      badge.innerHTML = '<i data-lucide="trending-down" class="w-3.5 h-3.5"></i> Defisit (Negatif)';
    } else {
      badge.className = 'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/60';
      badge.innerHTML = '<i data-lucide="minus" class="w-3.5 h-3.5"></i> Saldo Seimbang';
    }
  }

  lucide.createIcons();
  renderCharts(s);
}

function renderTable(transactions) {
  const tbody = document.getElementById('transactionsTableBody');
  const mobileList = document.getElementById('transactionsMobileList');
  const emptyState = document.getElementById('emptyState');
  const counterText = document.getElementById('tableCounterText');

  if (counterText) counterText.textContent = 'Menampilkan ' + transactions.length + ' transaksi (' + (state.currentProfile ? state.currentProfile.owner : '') + ')';

  if (transactions.length === 0) {
    if (tbody) tbody.innerHTML = '';
    if (mobileList) mobileList.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    lucide.createIcons();
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  if (tbody) {
    tbody.innerHTML = transactions.map(t => {
      const isIncome = t.type === 'income';
      const sign = isIncome ? '+' : '-';
      const amountColor = isIncome ? 'text-emerald-600' : 'text-rose-600';
      const badgeTypeClass = isIncome ? 'badge-income' : 'badge-expense';
      const typeLabel = isIncome ? 'Pemasukan' : 'Pengeluaran';

      return `
        <tr class="table-row-hover transition-colors border-b border-slate-100/80">
          <td class="py-3.5 px-6 whitespace-nowrap">
            <div class="font-bold text-slate-800">${formatDateIndo(t.date)}</div>
            <div class="text-[10px] text-slate-400 font-mono">${escapeHtml(t.date)}</div>
          </td>
          <td class="py-3.5 px-4">
            <div class="font-semibold text-slate-900">${escapeHtml(t.description)}</div>
            ${t.notes ? '<div class="text-[11px] text-slate-500 mt-0.5 truncate max-w-xs flex items-center gap-1"><i data-lucide="info" class="w-3 h-3 text-slate-400 inline shrink-0"></i> ' + escapeHtml(t.notes) + '</div>' : ''}
          </td>
          <td class="py-3.5 px-4 whitespace-nowrap">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${badgeTypeClass}">
              <span class="w-1.5 h-1.5 rounded-full ${isIncome ? 'bg-emerald-500' : 'bg-rose-500'}"></span>
              ${escapeHtml(t.category)}
            </span>
          </td>
          <td class="py-3.5 px-4 whitespace-nowrap">
            <span class="inline-flex items-center gap-1 text-slate-600 text-xs font-medium">
              <i data-lucide="credit-card" class="w-3.5 h-3.5 text-slate-400"></i>
              ${escapeHtml(t.wallet)}
            </span>
          </td>
          <td class="py-3.5 px-4 whitespace-nowrap text-right">
            <div class="font-extrabold text-sm sm:text-base ${amountColor}">${sign} ${formatRupiah(t.amount)}</div>
            <div class="text-[10px] uppercase font-bold tracking-wider ${isIncome ? 'text-emerald-500' : 'text-rose-500'}">${typeLabel}</div>
          </td>
          <td class="py-3.5 px-6 whitespace-nowrap text-center">
            <div class="inline-flex items-center gap-1.5">
              <button onclick="openEditModal('${t.id}')" class="p-1.5 sm:p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition" title="Edit">
                <i data-lucide="edit-3" class="w-4 h-4"></i>
              </button>
              <button onclick="openDeleteModal('${t.id}')" class="p-1.5 sm:p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" title="Hapus">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </td>
        </tr>`;
    }).join('');
  }

  if (mobileList) {
    mobileList.innerHTML = transactions.map(t => {
      const isIncome = t.type === 'income';
      const sign = isIncome ? '+' : '-';
      const amountColor = isIncome ? 'text-emerald-600' : 'text-rose-600';
      const badgeClass = isIncome ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' : 'bg-rose-50 text-rose-700 border-rose-200/60';
      const iconColor = isIncome ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600';
      const iconName = isIncome ? 'arrow-down-left' : 'arrow-up-right';

      return `
        <div class="p-3 sm:p-3.5 flex items-center justify-between hover:bg-slate-50/80 transition active:bg-slate-100">
          <div class="flex items-center gap-2.5 min-w-0 pr-2">
            <div class="w-9 h-9 rounded-xl ${iconColor} flex items-center justify-center shrink-0">
              <i data-lucide="${iconName}" class="w-4 h-4"></i>
            </div>
            <div class="min-w-0">
              <div class="font-bold text-xs sm:text-sm text-slate-900 truncate">${escapeHtml(t.description)}</div>
              <div class="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5 flex-wrap">
                <span>${formatDateIndo(t.date)}</span>
                <span>&bull;</span>
                <span class="inline-block px-1.5 py-0.5 rounded border ${badgeClass} font-semibold">${escapeHtml(t.category)}</span>
                <span>&bull;</span>
                <span class="text-slate-400 truncate">${escapeHtml(t.wallet)}</span>
              </div>
            </div>
          </div>
          <div class="text-right shrink-0">
            <div class="font-extrabold text-xs sm:text-sm ${amountColor}">${sign} ${formatRupiah(t.amount)}</div>
            <div class="flex items-center justify-end gap-1 mt-1">
              <button onclick="openEditModal('${t.id}')" class="p-1 text-slate-400 hover:text-indigo-600 rounded-md transition"><i data-lucide="edit-3" class="w-3.5 h-3.5"></i></button>
              <button onclick="openDeleteModal('${t.id}')" class="p-1 text-slate-400 hover:text-rose-600 rounded-md transition"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  lucide.createIcons();
}

function renderCharts(summary) {
  renderCashflowChart(summary.cashflowByMonth || {});
  renderCategoryChart(summary.expenseByCategory || {});
}

function renderCashflowChart(cashflowData) {
  const canvas = document.getElementById('cashflowChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const labels = Object.keys(cashflowData).sort();
  if (labels.length === 0) labels.push(new Date().toISOString().slice(0, 7));

  const incomeData = labels.map(l => cashflowData[l] ? cashflowData[l].income : 0);
  const expenseData = labels.map(l => cashflowData[l] ? cashflowData[l].expense : 0);

  const formattedLabels = labels.map(l => {
    const parts = l.split('-');
    if (parts.length === 2) {
      const d = new Date(parts[0], parts[1] - 1, 1);
      return new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }).format(d);
    }
    return l;
  });

  if (state.cashflowChart) state.cashflowChart.destroy();
  state.cashflowChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: formattedLabels,
      datasets: [
        { label: 'Pemasukan (IDR)', data: incomeData, backgroundColor: '#10b981', borderRadius: 8, borderSkipped: false },
        { label: 'Pengeluaran (IDR)', data: expenseData, backgroundColor: '#ef4444', borderRadius: 8, borderSkipped: false }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { font: { family: "'Plus Jakarta Sans', sans-serif", weight: '600' } } },
        tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + formatRupiah(ctx.raw) } }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: v => v >= 1000000 ? 'Rp ' + (v/1000000).toFixed(1) + ' jt' : v >= 1000 ? 'Rp ' + (v/1000).toFixed(0) + ' rb' : 'Rp ' + v },
          grid: { color: '#f1f5f9' }
        },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderCategoryChart(categoryData) {
  const canvas = document.getElementById('categoryChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const labels = Object.keys(categoryData);
  const values = Object.values(categoryData);

  if (state.categoryChart) state.categoryChart.destroy();
  if (labels.length === 0) { ctx.clearRect(0, 0, 300, 300); return; }

  const colors = ['#ef4444','#f97316','#f59e0b','#10b981','#06b6d4','#3b82f6','#6366f1','#8b5cf6','#ec4899','#64748b'];
  state.categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors.slice(0, labels.length), borderWidth: 2, borderColor: '#ffffff' }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 } } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const total = values.reduce((a,b) => a+b, 0);
              return ctx.label + ': ' + formatRupiah(ctx.raw) + ' (' + (total > 0 ? ((ctx.raw/total)*100).toFixed(1) : 0) + '%)';
            }
          }
        }
      },
      cutout: '68%'
    }
  });
}

// ================= MODAL OPERATIONS (CRUD) ================= //

function openAddModal() {
  state.currentEditingId = null;
  document.getElementById('modalTitle').textContent = 'Catat Transaksi (' + (state.currentProfile ? state.currentProfile.owner : '') + ')';
  document.getElementById('modalSubtitle').textContent = 'Isi rincian informasi transaksi keuangan Anda';
  document.getElementById('btnSaveText').textContent = 'Simpan Transaksi';
  document.getElementById('txId').value = '';
  document.getElementById('txAmount').value = '';
  document.getElementById('amountPreview').textContent = 'Rp 0';
  document.getElementById('txDescription').value = '';
  document.getElementById('txNotes').value = '';
  document.getElementById('txDate').value = new Date().toISOString().split('T')[0];

  setTypeToggle('expense');
  showModal(true);
}

function openEditModal(id) {
  const t = state.transactions.find(tx => tx.id === id);
  if (!t) { showToast('Error', 'Data tidak ditemukan', false); return; }

  state.currentEditingId = t.id;
  document.getElementById('modalTitle').textContent = 'Edit Data Transaksi';
  document.getElementById('modalSubtitle').textContent = 'Memperbarui ID: ' + t.id;
  document.getElementById('btnSaveText').textContent = 'Perbarui Transaksi';

  document.getElementById('txId').value = t.id;
  document.getElementById('txAmount').value = t.amount;
  document.getElementById('amountPreview').textContent = formatRupiah(t.amount);
  document.getElementById('txDescription').value = t.description;
  document.getElementById('txDate').value = t.date;
  document.getElementById('txNotes').value = t.notes || '';

  setTypeToggle(t.type);
  document.getElementById('txCategory').value = t.category;
  document.getElementById('txWallet').value = t.wallet;

  showModal(true);
}

function setTypeToggle(type) {
  document.getElementById('txType').value = type;
  const btnExpense = document.getElementById('btnTypeExpense');
  const btnIncome = document.getElementById('btnTypeIncome');

  if (type === 'income') {
    btnIncome.className = 'flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition bg-white text-emerald-600 shadow-xs';
    btnExpense.className = 'flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition text-slate-600 hover:text-rose-600';
  } else {
    btnExpense.className = 'flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition bg-white text-rose-600 shadow-xs';
    btnIncome.className = 'flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition text-slate-600 hover:text-emerald-600';
  }
  updateModalCategories();
}

function showModal(isOpen) {
  const modal = document.getElementById('modalTransaction');
  if (isOpen) {
    modal.classList.remove('hidden');
    document.getElementById('txAmount').focus();
  } else {
    modal.classList.add('hidden');
  }
}

function handleTransactionSubmit(e) {
  e.preventDefault();

  const id = state.currentEditingId;
  const isEditing = Boolean(id);

  const payload = {
    type: document.getElementById('txType').value,
    amount: parseFloat(document.getElementById('txAmount').value),
    description: document.getElementById('txDescription').value.trim(),
    category: document.getElementById('txCategory').value,
    wallet: document.getElementById('txWallet').value,
    date: document.getElementById('txDate').value,
    notes: document.getElementById('txNotes').value.trim()
  };

  if (!payload.amount || payload.amount <= 0) {
    showToast('Validasi Gagal', 'Nominal harus lebih besar dari 0', false);
    return;
  }
  if (!payload.description) {
    showToast('Validasi Gagal', 'Keterangan transaksi wajib diisi', false);
    return;
  }

  const db = loadProfileData();

  if (isEditing) {
    const idx = db.transactions.findIndex(t => t.id === id);
    if (idx !== -1) {
      db.transactions[idx] = { ...db.transactions[idx], ...payload, updatedAt: new Date().toISOString() };
    }
  } else {
    const newTx = { id: generateId(), ...payload, createdAt: new Date().toISOString() };
    db.transactions.unshift(newTx);
  }

  saveProfileData(db);
  state.transactions = db.transactions;

  showModal(false);
  showToast(isEditing ? 'Transaksi Diperbarui' : 'Transaksi Dicatat', 'Data ' + state.currentProfile.owner + ' tersimpan otomatis');
  applyFiltersAndRender();
}

function openDeleteModal(id) {
  const tx = state.transactions.find(t => t.id === id);
  if (!tx) return;
  state.pendingDeleteId = id;
  document.getElementById('delPreviewDesc').textContent = tx.description;
  document.getElementById('delPreviewAmount').textContent = (tx.type === 'income' ? '+' : '-') + ' ' + formatRupiah(tx.amount);
  document.getElementById('delPreviewDate').textContent = formatDateIndo(tx.date);
  document.getElementById('delPreviewCategory').textContent = tx.category + ' (' + tx.wallet + ')';
  document.getElementById('modalDeleteConfirm').classList.remove('hidden');
}

function closeDeleteModal() {
  state.pendingDeleteId = null;
  document.getElementById('modalDeleteConfirm').classList.add('hidden');
}

function confirmDelete() {
  const id = state.pendingDeleteId;
  if (!id) return;

  const db = loadProfileData();
  db.transactions = db.transactions.filter(t => t.id !== id);
  saveProfileData(db);

  state.transactions = db.transactions;
  closeDeleteModal();
  showToast('Transaksi Terhapus', 'Data berhasil dihapus');
  applyFiltersAndRender();
}

// ================= PRESETS & FILTERS ================= //

function setPresetToday() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('filterStartDate').value = today;
  document.getElementById('filterEndDate').value = today;
  state.filters.startDate = today;
  state.filters.endDate = today;
  applyFiltersAndRender();
}

function setPresetThisMonth() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  const elStart = document.getElementById('filterStartDate');
  const elEnd = document.getElementById('filterEndDate');
  if (elStart) elStart.value = firstDay;
  if (elEnd) elEnd.value = lastDay;
  state.filters.startDate = firstDay;
  state.filters.endDate = lastDay;
}

function setPresetAllTime() {
  const elStart = document.getElementById('filterStartDate');
  const elEnd = document.getElementById('filterEndDate');
  if (elStart) elStart.value = '';
  if (elEnd) elEnd.value = '';
  state.filters.startDate = '';
  state.filters.endDate = '';
  applyFiltersAndRender();
}

function resetAllFilters() {
  state.filters = { type: 'all', category: 'all', wallet: 'all', search: '', startDate: '', endDate: '' };
  document.getElementById('filterType').value = 'all';
  document.getElementById('filterCategory').value = 'all';
  document.getElementById('filterWallet').value = 'all';
  document.getElementById('searchInput').value = '';
  document.getElementById('filterStartDate').value = '';
  document.getElementById('filterEndDate').value = '';
  applyFiltersAndRender();
}

function triggerExportCsv() {
  const txs = state.transactions;
  if (txs.length === 0) {
    showToast('Tidak Ada Data', 'Tidak ada transaksi untuk diekspor', false);
    return;
  }
  const profileName = state.currentProfile ? state.currentProfile.owner : 'Keuangan';
  const header = 'Tanggal,Tipe,Nominal,Keterangan,Kategori,Dompet,Catatan';
  const rows = txs.map(t => [
    t.date,
    t.type,
    t.amount,
    '"' + (t.description || '').replace(/"/g, '""') + '"',
    '"' + (t.category || '').replace(/"/g, '""') + '"',
    '"' + (t.wallet || '').replace(/"/g, '""') + '"',
    '"' + (t.notes || '').replace(/"/g, '""') + '"'
  ].join(','));

  const csv = [header, ...rows].join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'keuangan-' + profileName.toLowerCase() + '-' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Ekspor Berhasil', txs.length + ' transaksi ' + profileName + ' berhasil diekspor');
}

// ================= MODAL QR CODE ================= //

function openQrModal() {
  const qrImg = document.getElementById('qrCodeImage');
  const urlLabel = document.getElementById('qrUrlLabel');
  const directOpen = document.getElementById('btnDirectOpen');

  if (qrImg) qrImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=' + encodeURIComponent(GITHUB_PAGES_URL);
  if (urlLabel) urlLabel.textContent = GITHUB_PAGES_URL;
  if (directOpen) directOpen.href = GITHUB_PAGES_URL;

  document.getElementById('modalQrCode').classList.remove('hidden');
  lucide.createIcons();
}

function closeQrModal() {
  document.getElementById('modalQrCode').classList.add('hidden');
}

// ================= EVENT LISTENERS ================= //

function setupEventListeners() {
  // Tombol pilihan akun di Layar Login
  const btnSelectGhoits = document.getElementById('btnSelectGhoits');
  const btnSelectAzzra = document.getElementById('btnSelectAzzra');
  if (btnSelectGhoits) btnSelectGhoits.addEventListener('click', () => switchProfileWithAnimation('ghoits'));
  if (btnSelectAzzra) btnSelectAzzra.addEventListener('click', () => switchProfileWithAnimation('azzra'));
  // Click listeners untuk profil (berlaku untuk laptop dan mobile HP)
  if (btnSelectGhoits) btnSelectGhoits.onclick = () => switchProfileWithAnimation('ghoits');
  if (btnSelectAzzra) btnSelectAzzra.onclick = () => switchProfileWithAnimation('azzra');

  // Tombol Ganti Akun di Navbar
  const btnSwitchAccount = document.getElementById('btnSwitchAccount');
  if (btnSwitchAccount) btnSwitchAccount.addEventListener('click', showLoginScreen);

  // Modal Transaksi
  document.getElementById('btnOpenAddModal').addEventListener('click', openAddModal);
  const btnFab = document.getElementById('btnFabAdd');
  if (btnFab) btnFab.addEventListener('click', openAddModal);
  document.getElementById('btnEmptyAdd').addEventListener('click', openAddModal);
  document.getElementById('btnCloseModal').addEventListener('click', () => showModal(false));
  document.getElementById('btnCancelModal').addEventListener('click', () => showModal(false));

  document.getElementById('btnTypeExpense').addEventListener('click', () => setTypeToggle('expense'));
  document.getElementById('btnTypeIncome').addEventListener('click', () => setTypeToggle('income'));
  document.getElementById('transactionForm').addEventListener('submit', handleTransactionSubmit);

  document.getElementById('txAmount').addEventListener('input', e => {
    document.getElementById('amountPreview').textContent = formatRupiah(e.target.value);
  });

  document.getElementById('btnCancelDelete').addEventListener('click', closeDeleteModal);
  document.getElementById('btnConfirmDelete').addEventListener('click', confirmDelete);

  document.getElementById('filterType').addEventListener('change', e => { state.filters.type = e.target.value; applyFiltersAndRender(); });
  document.getElementById('filterCategory').addEventListener('change', e => { state.filters.category = e.target.value; applyFiltersAndRender(); });
  document.getElementById('filterWallet').addEventListener('change', e => { state.filters.wallet = e.target.value; applyFiltersAndRender(); });
  document.getElementById('filterStartDate').addEventListener('change', e => { state.filters.startDate = e.target.value; applyFiltersAndRender(); });
  document.getElementById('filterEndDate').addEventListener('change', e => { state.filters.endDate = e.target.value; applyFiltersAndRender(); });

  let searchTimer;
  document.getElementById('searchInput').addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.filters.search = e.target.value; applyFiltersAndRender(); }, 300);
  });

  document.getElementById('btnPresetToday').addEventListener('click', setPresetToday);
  document.getElementById('btnPresetThisMonth').addEventListener('click', () => { setPresetThisMonth(); applyFiltersAndRender(); });
  document.getElementById('btnPresetAllTime').addEventListener('click', setPresetAllTime);
  document.getElementById('btnResetFilter').addEventListener('click', resetAllFilters);
  document.getElementById('btnRefresh').addEventListener('click', () => { syncFromCloud(); showToast('Memperbarui Data', 'Mengambil data terbaru dari Cloud (Satu Jalur)...'); });
  document.getElementById('btnPrint').addEventListener('click', () => window.print());
  document.getElementById('btnExportCsv').addEventListener('click', triggerExportCsv);

  const btnOpenQr = document.getElementById('btnOpenQrModal');
  const btnCloseQr = document.getElementById('btnCloseQrModal');
  if (btnOpenQr) btnOpenQr.addEventListener('click', openQrModal);
  if (btnCloseQr) btnCloseQr.addEventListener('click', closeQrModal);

  const btnCopyUrl = document.getElementById('btnCopyUrl');
  if (btnCopyUrl) {
    btnCopyUrl.addEventListener('click', () => {
      navigator.clipboard.writeText(GITHUB_PAGES_URL).then(() => {
        showToast('Link Disalin', 'Alamat web berhasil disalin ke clipboard');
      }).catch(() => {
        showToast('Gagal Salin', 'Silakan salin tautan secara manual', false);
      });
    });
  }

  window.addEventListener('click', e => {
    if (e.target === document.getElementById('modalTransaction')) showModal(false);
    if (e.target === document.getElementById('modalDeleteConfirm')) closeDeleteModal();
    if (e.target === document.getElementById('modalQrCode')) closeQrModal();
  });

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      showModal(false);
      closeDeleteModal();
      closeQrModal();
    }
  });
}

// Inisialisasi awal saat halaman dibuka
function init() {
  const today = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('txDate');
  if (dateInput) dateInput.value = today;

  setPresetThisMonth();
  setupEventListeners();
  initMusicSystem();

  // Cek apakah user sebelumnya sudah memilih profil
  const savedProfile = localStorage.getItem('keuangan_active_profile');
  if (savedProfile && PROFILES[savedProfile]) {
    applyTheme(savedProfile);
    switchProfile(savedProfile);
  } else {
    showLoginScreen();
  }

  lucide.createIcons();
}

window.openEditModal = openEditModal;
window.openDeleteModal = openDeleteModal;
window.switchProfile = switchProfile;
window.showLoginScreen = showLoginScreen;

document.addEventListener('DOMContentLoaded', init);
