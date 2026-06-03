let map;
let currentUserId = null;
let currentPos = null;
let waypoints = []; 
let waypointMarkers = []; 
let mysteryMarkers = [];
let mysteryData = [];
let allMysteryMarkers = []; // 含所有章節的地圖標記資料
let routeLayer = null;
let routingStrategy = 'optimize';
let currentStoryChapter = 1;
let parallelUnlocked = false;


// ==========================================
// AUDIO SYSTEM (Web Audio API 產生科幻音效)
// ==========================================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, type, duration, vol=0.1) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

// 短促的 UI 點擊聲
function playClickSound() { playTone(800, 'square', 0.1, 0.05); }

// 獲得徽章的升調音效
function playUnlockSound() {
    playTone(440, 'sine', 0.2, 0.2);
    setTimeout(() => playTone(554, 'sine', 0.2, 0.2), 100);
    setTimeout(() => playTone(659, 'sine', 0.4, 0.2), 200);
    setTimeout(() => playTone(880, 'square', 0.8, 0.2), 300);
}

// 平行世界異常警報聲 (修改為輕柔空靈的微光風鈴聲)
function playEtherealChime() {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, index) => {
        setTimeout(() => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
            gain.gain.setValueAtTime(0, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.1); // 輕柔漸入
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 3.0); // 悠長餘音
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 3.0);
        }, index * 150); // 如風鈴般錯落響起
    });
}

// ==========================================
// Terminal UI: Toast Notification System
// ==========================================
function sysLog(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let prefix = '[SYS.INFO]';
    if(type === 'success') prefix = '[SYS.OK]';
    if(type === 'error') prefix = '[SYS.ERR]';
    if(type === 'warning') prefix = '[SYS.WARN]';
    toast.innerHTML = `<strong>${prefix}</strong> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('fade-out'); setTimeout(() => toast.remove(), 400); }, 4000);
}

// ==========================================
// Strategy Selector
// ==========================================
window.setStrategy = function(el, strategy) {
    playClickSound();
    document.querySelectorAll('.strategy-selector .cyber-radio').forEach(r => r.classList.remove('active'));
    el.classList.add('active');
    routingStrategy = strategy;
    sysLog(`ROUTING_STRATEGY_CHANGED: ${strategy.toUpperCase()}`, "info");
};

// ==========================================
// Streak UI Updater
// ==========================================
function updateStreakUI(streak, nextBadge) {
    const streakVal = document.getElementById('streak-val');
    const progressBar = document.getElementById('progress-bar-fill');
    const target = nextBadge ? nextBadge.required_streak : 7;
    const displayStreak = Math.min(streak, target);
    const progress = target > 0 ? Math.min((displayStreak / target) * 100, 100) : 0;
    streakVal.innerText = `${displayStreak}/${target}`;
    progressBar.style.width = `${progress}%`;
}

// ==========================================
// Initialization & Map Setup
// ==========================================
function initMap() {
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([25.0330, 121.5654], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);
    map.on('mousemove', (e) => { document.getElementById('hud-coords').innerText = `COORD: ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`; });
    locateUser();
}

function locateUser() {
    playClickSound();
    const defaultPos = [25.0330, 121.5654]; // Default (Taipei 101)
    const setUserMarker = (pos, message, type) => {
        currentPos = pos;
        map.setView(currentPos, 15);
        const radarIcon = L.divIcon({ html: `<div class="radar-marker"><div class="radar-ping"></div></div>`, className: 'custom-div-icon', iconSize: [20, 20], iconAnchor: [10, 10] });
        L.marker(currentPos, { icon: radarIcon }).addTo(map).bindPopup("<b>ENTITY_LOCATED</b><br>STATUS: STANDBY").openPopup();
        if(message) sysLog(message, type);
    };

    if (navigator.geolocation) {
        sysLog("INITIATING_SCAN...", "info");
        navigator.geolocation.getCurrentPosition(pos => {
            setUserMarker([pos.coords.latitude, pos.coords.longitude], "LOCATION_SYNC_COMPLETE", "success");
        }, (error) => {
            setUserMarker(defaultPos, "GPS_SIGNAL_LOST. OVERRIDING_WITH_DEFAULT_COORD.", "warning");
        }, { timeout: 5000 });
    } else {
        setUserMarker(defaultPos, "HARDWARE_NOT_SUPPORTED. OVERRIDING.", "error");
    }
}

// ==========================================
// AUTH SYSTEM (強化除錯版)
// ==========================================
let authMode = 'login';
function toggleAuthModal(show) {
    playClickSound();
    const modal = document.getElementById('auth-modal');
    if(show) { modal.classList.remove('hidden'); document.getElementById('auth-error-msg').innerText = ''; document.getElementById('auth-password').value = ''; } 
    else { modal.classList.add('hidden'); }
}
function switchAuthTab(mode) {
    playClickSound();
    authMode = mode;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.tab-btn[data-tab="${mode}"]`).classList.add('active');
    document.getElementById('auth-submit').innerText = mode === 'login' ? 'EXECUTE_LOGIN' : 'INITIATE_REGISTRATION';
    document.getElementById('auth-error-msg').innerText = '';
}

async function handleAuthSubmit() {
    playClickSound();
    const username = document.getElementById('auth-username').value;
    const password = document.getElementById('auth-password').value;
    const errorMsg = document.getElementById('auth-error-msg');
    if(!username || !password) { errorMsg.innerText = "ERROR: Missing credentials."; return; }
    
    sysLog(`PROCESSING_AUTH...`, "info");
    const endpoint = authMode === 'login' ? '/api/login' : '/api/register';
    
    try {
        const res = await fetch(endpoint, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ username, password }) 
        });
        
        const responseText = await res.text();
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error("Server Response Error:", responseText);
            errorMsg.innerText = "ERROR: Server Response format error.";
            return;
        }
        
        if (!res.ok) { 
            errorMsg.innerText = `ERROR: ${data.error || 'Unknown error'}`; 
            sysLog("AUTH_REJECTED", "error"); 
            return; 
        }

        if (authMode === 'register') {
            sysLog("REGISTRATION_SUCCESS", "success");
            switchAuthTab('login');
            document.getElementById('auth-password').value = '';
        } else {
            currentUserId = data.id;
            document.getElementById('username-display').innerText = data.username;
            updateStreakUI(data.streak_count, data.next_badge);
            
            if (data.streak_broken) {
                setTimeout(() => {
                    document.getElementById('streak-broken-modal').classList.remove('hidden');
                }, 500);
            }

            if (data.parallel_unlocked) {
                parallelUnlocked = true;
                const btn = document.getElementById('toggle-parallel');
                btn.classList.remove('locked');
                btn.classList.add('unlocked');
                btn.querySelector('.fab-text').innerText = 'PARALLEL_WORLD';
                btn.title = 'OVERRIDE_REALITY';
                updateStoryProgress();
            }
            if (data.game_completed) {
                setTimeout(() => sysLog("GAME_COMPLETE: 你已成功逃脫現實世界", "success"), 1000);
            }
            
            document.getElementById('login-btn').classList.add('hidden');
            document.getElementById('logout-btn').classList.remove('hidden');
            document.getElementById('badge-btn').classList.remove('hidden');
            document.getElementById('history-btn').classList.remove('hidden');
            document.getElementById('report-list-btn').classList.remove('hidden');
            
            toggleAuthModal(false);
            sysLog(`ACCESS_GRANTED. WELCOME ${data.username}`, "success");
            loadMoodHistory();
        }
    } catch(e) { 
        console.error("Auth Exception:", e);
        errorMsg.innerText = "ERROR: Connection lost."; 
        sysLog("NETWORK_FAILURE", "error"); 
    }
}

// ==========================================
// BADGE SYSTEM
// ==========================================
async function loadBadges() {
    playClickSound();
    if (!currentUserId) return;
    try {
        const res = await fetch(`/api/badges?user_id=${currentUserId}`);
        const badges = await res.json();
        const container = document.getElementById('badge-list');
        container.innerHTML = '';
        badges.forEach(b => {
            const isEarned = b.earned_at !== null;
            container.innerHTML += `
                <div class="badge-item ${isEarned ? 'earned' : 'locked'}">
                    <i class="fa-solid fa-award"></i>
                    <div>
                        <strong>${b.name}</strong>
                        <p>${b.description}</p>
                    </div>
                </div>
            `;
        });
        document.getElementById('badge-modal').classList.remove('hidden');
    } catch(e) { sysLog("FAILED_TO_LOAD_BADGES", "error"); }
}

// 自訂炫酷解鎖畫面
function showCustomUnlock(title, message) {
    playUnlockSound();
    document.getElementById('unlock-badge-name').innerText = title;
    document.getElementById('unlock-message').innerText = message;
    document.getElementById('unlock-modal').classList.remove('hidden');
}

// ==========================================
// MULTI-WAYPOINT ROUTING
// ==========================================
function updateWaypointsUI() {
    const listDiv = document.getElementById('waypoints-list');
    listDiv.innerHTML = '';
    
    waypoints.forEach((wp, index) => {
        const item = document.createElement('div');
        item.className = 'waypoint-item';
        item.innerHTML = `
            <div class="waypoint-index">W${index + 1}</div>
            <div class="waypoint-name">${wp.name}</div>
            <div class="remove-wp" onclick="removeWaypoint(${index})"><i class="fa-solid fa-xmark"></i></div>
        `;
        listDiv.appendChild(item);
    });

    if (waypoints.length > 0) {
        document.getElementById('routing-controls').classList.remove('hidden');
    } else {
        document.getElementById('routing-controls').classList.add('hidden');
        document.getElementById('route-metrics').classList.add('hidden');
    }
}

window.removeWaypoint = function(index) {
    playClickSound();
    waypoints.splice(index, 1);
    if(waypointMarkers[index]) {
        map.removeLayer(waypointMarkers[index]);
        waypointMarkers.splice(index, 1);
    }
    updateWaypointsUI();
    sysLog("WAYPOINT_REMOVED", "info");
    
    if(waypoints.length === 0 && routeLayer) {
        map.removeLayer(routeLayer);
        routeLayer = null;
        document.getElementById('route-metrics').classList.add('hidden');
    }
};

async function searchLocation(query) {
    playClickSound();
    sysLog("SCANNING_SECTOR...", "info");
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const data = await res.json();
        
        if (data && data.length > 0) {
            const result = data[0];
            const wp = {
                name: result.name || query,
                lat: parseFloat(result.lat),
                lng: parseFloat(result.lon)
            };
            
            waypoints.push(wp);
            map.flyTo([wp.lat, wp.lng], 15, { duration: 1.5 });
            
            const targetIcon = L.divIcon({
                html: `<div style="color:var(--danger); font-size:24px; text-shadow: var(--danger-glow);"><i class="fa-solid fa-crosshairs"></i></div>`,
                className: 'custom-div-icon',
                iconSize: [24, 24], iconAnchor: [12, 12]
            });
            const marker = L.marker([wp.lat, wp.lng], { icon: targetIcon }).addTo(map)
                .bindPopup(`<b>WAYPOINT_${waypoints.length}</b><br>${wp.name}`);
            
            waypointMarkers.push(marker);
            updateWaypointsUI();
            document.getElementById('search-input').value = '';
            sysLog("WAYPOINT_ACQUIRED", "success");
        } else {
            sysLog("SECTOR_NOT_FOUND", "error");
        }
    } catch (e) { sysLog("NETWORK_FAILURE", "error"); }
}

async function getRoute(mode = 'driving') {
    playClickSound();
    if (document.body.classList.contains('parallel-world')) { sysLog("ROUTING_UNAVAILABLE: 平行世界中無法進行路徑規劃", "error"); return; }
    if (!currentPos || waypoints.length === 0) { sysLog("MISSING_COORDINATES_FOR_ROUTING", "error"); return; }

    // 更新按鈕常亮狀態
    document.getElementById('route-btn-drive').classList.remove('active-btn');
    document.getElementById('route-btn-walk').classList.remove('active-btn');
    if (mode === 'driving') document.getElementById('route-btn-drive').classList.add('active-btn');
    if (mode === 'foot') document.getElementById('route-btn-walk').classList.add('active-btn');

    const actualStrategy = (routingStrategy === 'optimize' && waypoints.length >= 2) ? 'optimize' : 'sequential';
    sysLog(actualStrategy === 'optimize' ? "AI_OPTIMIZING_MULTI_NODE_TRAJECTORY..." : "CALCULATING_SEQUENTIAL_TRAJECTORY...", "info");
    
    let coordsArr = [`${currentPos[1]},${currentPos[0]}`];
    waypoints.forEach(wp => coordsArr.push(`${wp.lng},${wp.lat}`));
    const coordsStr = coordsArr.join(';');

    try {
        const res = await fetch(`/api/route?coords=${coordsStr}&mode=${mode}&strategy=${actualStrategy}`);
        const data = await res.json();

        let geojson, distance, duration;

        if (actualStrategy === 'optimize' && data.trips && data.trips.length > 0) {
            geojson = data.trips[0].geometry;
            distance = (data.trips[0].distance / 1000).toFixed(2); 
            duration = Math.round(data.trips[0].duration / 60); 
        } else if (actualStrategy === 'sequential' && data.routes && data.routes.length > 0) {
            geojson = data.routes[0].geometry;
            distance = (data.routes[0].distance / 1000).toFixed(2); 
            duration = Math.round(data.routes[0].duration / 60); 
        } else {
            sysLog("ROUTING_FAILED: INVALID_DATA", "error"); 
            return;
        }

        // --- 核心：不同交通工具的時間與視覺模擬 ---
        let routeColor = getComputedStyle(document.body).getPropertyValue('--theme-color').trim();
        let routeDash = '';

        if (mode === 'foot') {
            duration = Math.round((distance / 4.5) * 60); // 步行：4.5 km/h
            routeDash = '5, 10'; // 點狀虛線
        }

        if (routeLayer) map.removeLayer(routeLayer);
        routeLayer = L.geoJSON(geojson, {
            style: { 
                color: routeColor, 
                weight: 5, 
                opacity: 0.85, 
                dashArray: routeDash 
            }
        }).addTo(map);
        
        map.flyToBounds(routeLayer.getBounds(), { padding: [50, 50], duration: 1.5 });
        
        document.getElementById('metric-dist').innerText = `${distance} KM`;
        document.getElementById('metric-time').innerText = `${duration} MIN`;
        document.getElementById('route-metrics').classList.remove('hidden');

        sysLog(`TRAJECTORY_LOCKED // MODE: ${mode.toUpperCase()}`, "success");

    } catch(e) { sysLog("SERVER_ERROR_ROUTING", "error"); }
}

// ==========================================
// Core Features: Emotion Uplink & History
// ==========================================
async function recordMood(moodType, emoji) {
    playClickSound();
    if (!currentUserId) { sysLog("AUTH_REQUIRED_FOR_UPLINK", "warning"); toggleAuthModal(true); return; }
    if (!currentPos) { sysLog("LOCATION_SYNC_REQUIRED", "warning"); return; }

    const noteInput = document.getElementById('mood-note');
    const noteText = noteInput.value.trim();
    
    // 強制輸入文字才能打卡
    if (!noteText) {
        sysLog("INPUT_REQUIRED: 必須輸入當下想法才能簽到", "error");
        noteInput.style.borderColor = "var(--danger)";
        noteInput.style.boxShadow = "0 0 10px var(--danger)";
        setTimeout(() => { noteInput.style.borderColor = ""; noteInput.style.boxShadow = ""; }, 2000);
        return;
    }

    // 取得當下的真實地點名稱 (精確版逆向地理編碼)
    sysLog("RESOLVING_LOCATION...", "info");
    let locName = "未知的避風港";
    try {
        // 加上 accept-language 確保回傳繁體中文
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${currentPos[0]}&lon=${currentPos[1]}&accept-language=zh-TW`);
        const geoData = await geoRes.json();
        if (geoData && geoData.address) {
            const addr = geoData.address;
            
            // 優先尋找具體地標 (Point of Interest)
            const poi = addr.amenity || addr.building || addr.shop || addr.tourism || addr.leisure || addr.historic || addr.office;
            
            // 抓取行政區與街道
            const city = addr.city || addr.town || addr.county || '';
            const district = addr.suburb || addr.village || '';
            const street = addr.road || addr.pedestrian || '';
            
            // 組合字串，例如 "新竹市東區光復路二段"
            let area = `${city}${district}${street}`.trim();
            
            // 如果有地標，就用括號加上去
            if (poi) {
                locName = area ? `${area} [${poi}]` : poi;
            } else {
                locName = area || "秘密座標";
            }
        }
    } catch(e) { console.log("Geocoding failed"); }

    sysLog("TRANSMITTING_EMOTION_DATA...", "info");
    const payload = {
        user_id: currentUserId, mood_type: moodType, emoji: emoji,
        lat: currentPos[0], lng: currentPos[1], location_name: locName,
        note: noteText
    };

    try {
        const res = await fetch('/api/moods', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        // 攔截「一天只能一次」等後端回傳的錯誤
        if (!res.ok) {
            sysLog(`SYNC_FAILED: ${data.error}`, "error");
            return;
        }
        
        if (data.status === 'success') {
            noteInput.value = ''; // 清空輸入框
            renderMoodMarker(payload);
            updateStreakUI(data.streak, data.next_badge);
            sysLog(`UPLINK_SUCCESS [ ${moodType} ]`, "success");
            
            if (data.new_badge) {
                sysLog(`BADGE_UNLOCKED: ${data.new_badge}`, "success");
                setTimeout(() => { showCustomUnlock(`獲得成就：${data.new_badge}`, "你的情緒記憶已鐫刻於地圖之上。"); }, 500);
            }
            
            if (data.parallel_unlocked && !parallelUnlocked) {
                parallelUnlocked = true;
                setTimeout(() => {
                    playEtherealChime();
                    const btn = document.getElementById('toggle-parallel');
                    btn.classList.remove('locked');
                    btn.classList.add('unlocked');
                    btn.querySelector('.fab-text').innerText = 'PARALLEL_WORLD';
                    btn.title = 'OVERRIDE_REALITY';
                    document.getElementById('parallel-unlock-modal').classList.remove('hidden');
                }, 1000);
            }

            if (data.mystery_event) {
                setTimeout(() => {
                    if (data.mystery_event.report) {
                        document.getElementById('report-content').innerText = data.mystery_event.report;
                        document.getElementById('report-modal').classList.remove('hidden');
                    }
                }, 3000);
            }
        }
    } catch(e) { sysLog("TRANSMISSION_FAILED", "error"); }
}

function renderMoodMarker(m) {
    const customIcon = L.divIcon({ html: `<div class="hex-marker">${m.emoji}</div>`, className: 'custom-mood-marker', iconSize: [40, 45], iconAnchor: [20, 22] });
    L.marker([m.lat, m.lng], { icon: customIcon }).addTo(map).bindPopup(`<b>STATUS: ${m.mood_type}</b><br><small>DATA_LOGGED</small>`);
}

async function loadMoodHistory() {
    if (!currentUserId) return;
    try {
        const res = await fetch(`/api/moods?user_id=${currentUserId}`);
        const moods = await res.json();
        moods.forEach(m => renderMoodMarker(m));
    } catch (e) { sysLog("FAILED_TO_FETCH_LOGS", "error"); }
}

let currentCalDate = new Date();
let userMoodHistory = [];

async function showHistoryModal() {
    playClickSound();
    if (!currentUserId) return;
    sysLog("FETCHING_ARCHIVES...", "info");
    try {
        const res = await fetch(`/api/moods?user_id=${currentUserId}`);
        userMoodHistory = await res.json();
        currentCalDate = new Date(); // 重置為當前月份
        renderCalendar();
        document.getElementById('history-modal').classList.remove('hidden');
    } catch (e) { sysLog("ARCHIVE_RETRIEVAL_FAILED", "error"); }
}

function renderCalendar() {
    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();
    document.getElementById('cal-month-year').innerText = `${year} - ${(month+1).toString().padStart(2, '0')}`;
    
    const firstDay = new Date(year, month, 1).getDay(); // 0(Sun) - 6(Sat)
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';
    
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    dayNames.forEach(d => { grid.innerHTML += `<div class="cal-header-day">${d}</div>`; });
    
    for (let i = 0; i < firstDay; i++) { grid.innerHTML += `<div class="cal-day empty"></div>`; }
    
    for (let day = 1; day <= daysInMonth; day++) {
        // 尋找此日期是否有打卡紀錄
        const mood = userMoodHistory.find(m => {
            const d = new Date(m.created_at + 'Z');
            return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
        });
        
        if (mood) {
            const safeMoodJson = JSON.stringify(mood).replace(/'/g, "&#39;").replace(/"/g, "&quot;");
            grid.innerHTML += `<div class="cal-day has-log" onclick="showMoodDetails(this, '${safeMoodJson}')">
                <span class="date-num">${day}</span>
                <div class="cal-emoji">${mood.emoji}</div>
            </div>`;
        } else {
            grid.innerHTML += `<div class="cal-day"><span class="date-num">${day}</span></div>`;
        }
    }
    document.getElementById('calendar-details').classList.add('hidden');
}

window.showMoodDetails = function(element, moodStr) {
    playClickSound();
    document.querySelectorAll('.cal-day').forEach(d => d.classList.remove('selected'));
    element.classList.add('selected');
    
    const mood = JSON.parse(moodStr.replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
    const d = new Date(mood.created_at + 'Z');
    const dateStr = d.toLocaleString('zh-TW', { hour12: false });
    
    const details = document.getElementById('calendar-details');
    details.innerHTML = `
        <div class="history-item">
            <div class="history-header">
                <div><span class="history-emoji">${mood.emoji}</span> <span class="history-title">${mood.mood_type}</span></div>
                <div class="history-date"><i class="fa-solid fa-location-dot"></i> ${mood.location_name} | ${dateStr}</div>
            </div>
            <div class="history-note">${mood.note}</div>
        </div>
    `;
    details.classList.remove('hidden');
}

async function loadReportList() {
    playClickSound();
    if (!currentUserId) return;
    sysLog("FETCHING_ANALYSIS_REPORTS...", "info");
    try {
        const res = await fetch(`/api/reports?user_id=${currentUserId}`);
        const reports = await res.json();
        const container = document.getElementById('report-list-container');
        container.innerHTML = '';
        
        if (reports.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted); text-align:center;">NO_ANALYSIS_DATA_FOUND</p>';
        } else {
            reports.forEach(r => {
                const dateObj = new Date(r.created_at + 'Z');
                const dateStr = dateObj.toLocaleString('zh-TW', { hour12: false });
                
                container.innerHTML += `
                    <div class="history-item" style="margin-bottom: 15px; border-left-color: var(--theme-color);">
                        <div class="history-header">
                            <div class="history-title"><i class="fa-solid fa-fingerprint"></i> NEURAL_ANALYSIS_REPORT</div>
                            <div class="history-date">${dateStr}</div>
                        </div>
                        <div class="history-note" style="color: #e0ffff; font-size: 0.9rem;">${r.content}</div>
                    </div>
                `;
            });
        }
        document.getElementById('report-list-modal').classList.remove('hidden');
    } catch (e) { sysLog("ARCHIVE_RETRIEVAL_FAILED", "error"); }
}

// ==========================================
// Story Progress UI
// ==========================================
const CHAPTER_NAMES = {1: 'ANOMALY_LAYER', 2: 'MIRROR_CITY', 3: 'THE_LAST_MEMORY'};
const CHAPTER_HINTS = {
    1: '尋找三個異常訊號源，揭開世界的裂縫。',
    2: '城市的另一面正在浮現，收集鏡像碎片。',
    3: '所有線索指向同一個終點，找回遺失的記憶。'
};

async function updateStoryProgress() {
    if (!currentUserId || !parallelUnlocked) return;
    try {
        const res = await fetch(`/api/mysteries?user_id=${currentUserId}`);
        const data = await res.json();
        const chapter = data.current_chapter || 1;
        const mysteries = data.mysteries || [];
        const total = mysteries.length;
        const completed = mysteries.filter(m => m.status === 'completed').length;
        const gameCompleted = data.game_completed;
        const isParallel = document.body.classList.contains('parallel-world');
        const container = document.querySelector('.story-progress-module');
        const barContainer = document.querySelector('.story-progress-module .streak-container');
        const hintEl = document.getElementById('story-chapter-hint');

        if (!isParallel && !gameCompleted) {
            container?.classList.add('hidden');
            return;
        }

        container?.classList.remove('hidden');

        if (gameCompleted && !isParallel) {
            document.getElementById('story-chapter-display').innerText = '✓ ALL_COMPLETE';
            document.getElementById('story-chapter-display').style.color = '#ffd700';
            barContainer?.classList.add('hidden');
            hintEl.innerText = '所有異常層已穿越。現實已逃脫。';
            hintEl.style.color = '#ffd700';
            return;
        }

        barContainer?.classList.remove('hidden');
        document.getElementById('story-chapter-display').innerText = gameCompleted ? 'CHAPTER: COMPLETE' : `CHAPTER ${chapter}: ${CHAPTER_NAMES[chapter] || '--'}`;
        document.getElementById('story-chapter-display').style.color = gameCompleted ? '#ffd700' : '';
        document.getElementById('story-fragment-count').innerText = gameCompleted ? '9/9 ✓' : `${completed}/${total}`;
        const pct = gameCompleted ? 100 : (total > 0 ? (completed / total) * 100 : 0);
        document.getElementById('story-progress-fill').style.width = `${pct}%`;
        document.getElementById('story-progress-fill').style.background = gameCompleted ? '#ffd700' : '';
        document.getElementById('story-progress-fill').style.boxShadow = gameCompleted ? '0 0 10px #ffd700' : '';
        hintEl.innerText = gameCompleted ? '所有異常層已穿越。現實已逃脫。你自由了。' : (CHAPTER_HINTS[chapter] || '');
        hintEl.style.color = gameCompleted ? '#ffd700' : '';
    } catch(e) {}
}

// ==========================================
// Event Listeners Setup
// ==========================================
function updateParallelUI() {
    const isParallel = document.body.classList.contains('parallel-world');
    const btnText = document.querySelector('.parallel-trigger .fab-text');
    const moodModule = document.querySelector('.mood-module');
    const mysteryModule = document.querySelector('.mystery-module');
    const searchModule = document.querySelector('.search-module');
    const badgeBtn = document.getElementById('badge-btn');
    const historyBtn = document.getElementById('history-btn');
    const reportBtn = document.getElementById('report-list-btn');
    const driveBtn = document.getElementById('route-btn-drive');
    const walkBtn = document.getElementById('route-btn-walk');
    if (isParallel) {
        btnText.innerText = "RETURN_TO_REALITY";
        document.querySelector('.sys-title').setAttribute('data-text', 'ANOMALY_REALM');
        document.querySelector('.sys-title').innerText = 'ANOMALY_REALM';
        sysLog("ANOMALY_REALM_ENTERED: 異常訊號層已展開", "info");
        moodModule?.classList.add('hidden');
        mysteryModule?.classList.remove('hidden');
        searchModule?.classList.add('hidden');
        showMysteryMarkers();
        updateStoryProgress();
        badgeBtn?.classList.add('hidden');
        historyBtn?.classList.add('hidden');
        reportBtn?.classList.add('hidden');
        if (driveBtn) {
            driveBtn.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> TRACE';
        }
        if (walkBtn) {
            walkBtn.innerHTML = '<i class="fa-solid fa-person-running"></i> INFILTRATE';
        }
    } else {
        btnText.innerText = "PARALLEL_WORLD";
        document.querySelector('.sys-title').setAttribute('data-text', 'ESCAPE_REALM');
        document.querySelector('.sys-title').innerText = 'ESCAPE_REALM';
        sysLog("REALITY_RESTORED", "success");
        moodModule?.classList.remove('hidden');
        mysteryModule?.classList.add('hidden');
        searchModule?.classList.remove('hidden');
        updateStoryProgress();
        if (currentUserId) {
            badgeBtn?.classList.remove('hidden');
            historyBtn?.classList.remove('hidden');
            reportBtn?.classList.remove('hidden');
        }
        if (driveBtn) {
            driveBtn.innerHTML = '<i class="fa-solid fa-truck-fast"></i> DRIVE';
        }
        if (walkBtn) {
            walkBtn.innerHTML = '<i class="fa-solid fa-shoe-prints"></i> WALK';
        }
        clearMysteryMarkers();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initMap();

    // 關閉自訂解鎖視窗
    document.getElementById('close-unlock').addEventListener('click', () => {
        playClickSound();
        document.getElementById('unlock-modal').classList.add('hidden');
    });

    // 關閉報告視窗
    document.getElementById('close-report').addEventListener('click', () => {
        playClickSound();
        document.getElementById('report-modal').classList.add('hidden');
    });

    document.getElementById('close-streak-broken').addEventListener('click', () => {
        playClickSound();
        document.getElementById('streak-broken-modal').classList.add('hidden');
    });

    document.getElementById('close-parallel-unlock').addEventListener('click', () => {
        playClickSound();
        document.getElementById('parallel-unlock-modal').classList.add('hidden');
        document.body.classList.add('parallel-world');
        updateParallelUI();
    });

    // 關閉歷史分析報告列表視窗
    document.getElementById('close-report-list').addEventListener('click', () => {
        playClickSound();
        document.getElementById('report-list-modal').classList.add('hidden');
    });

    document.getElementById('report-list-btn').addEventListener('click', loadReportList);

    // Auth Listeners
    document.getElementById('login-btn').addEventListener('click', () => toggleAuthModal(true));
    document.getElementById('close-modal').addEventListener('click', () => toggleAuthModal(false));
    document.getElementById('close-badge-modal').addEventListener('click', () => { playClickSound(); document.getElementById('badge-modal').classList.add('hidden'); });
    document.getElementById('close-mystery-modal').addEventListener('click', () => {
    playClickSound(); document.getElementById('mystery-modal').classList.add('hidden');});
    document.getElementById('close-final-modal').addEventListener('click', ()=>{            playClickSound(); document.getElementById(   'final-anomaly-modal').classList.add('hidden');});
    document.getElementById('close-scan-result').addEventListener('click', () => { playClickSound(); document.getElementById('scan-result-modal').classList.add('hidden'); });
    document.getElementById('close-scan-result-btn').addEventListener('click', () => { playClickSound(); document.getElementById('scan-result-modal').classList.add('hidden'); });
    document.getElementById('close-victory').addEventListener('click', () => { playClickSound(); document.getElementById('victory-modal').classList.add('hidden'); document.getElementById('report-list-modal').classList.add('hidden'); });
    document.getElementById('badge-btn').addEventListener('click', loadBadges);
    document.getElementById('mystery-btn').addEventListener('click', loadMysteries);
    document.getElementById('close-history-modal').addEventListener('click', () => { playClickSound(); document.getElementById('history-modal').classList.add('hidden'); });
    document.getElementById('close-story-archive').addEventListener('click',() => {
    playClickSound(); document.getElementById('story-archive-modal').classList.add('hidden');});
    document.getElementById('history-btn').addEventListener('click', showHistoryModal);
    document.getElementById('story-btn').addEventListener('click', () =>{
    playClickSound(); loadStoryArchive();});
    document.getElementById('cal-prev').addEventListener('click', () => { playClickSound(); currentCalDate.setMonth(currentCalDate.getMonth() - 1); renderCalendar(); });
    document.getElementById('cal-next').addEventListener('click', () => { playClickSound(); currentCalDate.setMonth(currentCalDate.getMonth() + 1); renderCalendar(); });
    document.querySelectorAll('.tab-btn').forEach(btn => { btn.addEventListener('click', (e) => switchAuthTab(e.target.getAttribute('data-tab'))); });
    document.getElementById('auth-submit').addEventListener('click', handleAuthSubmit);
    document.getElementById('logout-btn').addEventListener('click', () => {
        playClickSound();
        currentUserId = null;
        document.getElementById('username-display').innerText = 'GUEST_ENTITY';
        document.getElementById('streak-val').innerText = '0/7';
        document.getElementById('progress-bar-fill').style.width = '0%';
        document.getElementById('login-btn').classList.remove('hidden');
        document.getElementById('logout-btn').classList.add('hidden');
        document.getElementById('badge-btn').classList.add('hidden');
        document.getElementById('history-btn').classList.add('hidden');
        document.getElementById('report-list-btn').classList.add('hidden');
        sysLog("SESSION_TERMINATED", "info");
        setTimeout(() => location.reload(), 1000);
    });

    // Multi-Waypoint Routing Actions
    const searchAction = () => { const query = document.getElementById('search-input').value; if (query) searchLocation(query); };
    document.getElementById('search-btn').addEventListener('click', searchAction);
    document.getElementById('search-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') searchAction(); });
    
    document.getElementById('route-btn-drive').addEventListener('click', () => getRoute('driving'));
    document.getElementById('route-btn-walk').addEventListener('click', () => getRoute('foot'));
    document.getElementById('clear-route').addEventListener('click', () => {
        playClickSound();
        if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
        waypoints = [];
        waypointMarkers.forEach(m => map.removeLayer(m));
        waypointMarkers = [];
        updateWaypointsUI();
        
        // 清除常亮狀態
        document.getElementById('route-btn-drive').classList.remove('active-btn');
        document.getElementById('route-btn-walk').classList.remove('active-btn');
        document.getElementById('route-metrics').classList.add('hidden');
        
        sysLog("ALL_WAYPOINTS_CLEARED", "info");
    });

    // Mood Log
    document.querySelectorAll('.cyber-mood-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget;
            recordMood(target.getAttribute('data-mood'), target.getAttribute('data-emoji'));
        });
    });

    // Tactical Actions
    document.getElementById('toggle-parallel').addEventListener('click', () => { 
        playClickSound();
        if (!parallelUnlocked) {
            sysLog("ACCESS_DENIED: 需連續簽到 3 天才能進入平行世界", "error");
            return;
        }
        document.body.classList.toggle('parallel-world'); 
        updateParallelUI(); 
    });
});

//載入mystery//
async function loadMysteries() {
    if (!currentUserId) return;
    clearMysteryMarkers();
    try {
        const res = await fetch(
            `/api/mysteries?user_id=${currentUserId}`
        );
        const data = await res.json();
        currentStoryChapter = data.current_chapter;
        mysteryData = data.mysteries;
        allMysteryMarkers = data.all_mysteries || data.mysteries;
        const container =
            document.getElementById('mystery-list');
        container.innerHTML = '';
        allMysteryMarkers.forEach(m => {
            addMysteryMarker(m);
        });
        // modal 列表只顯示當前章節
        mysteryData.forEach(m => {
            const isCompleted = m.status === "completed";
            const statusIcon = isCompleted ? "◉" : "◎";
            const statusClass = isCompleted ? "completed" : (m.status === "locked" ? "locked" : "unlocked");
            const actionsHtml = isCompleted
                ? `<span class="mystery-completed-badge">✓ COMPLETED</span>
                   <button class="cyber-btn btn-sm" onclick="focusMystery(${m.lat}, ${m.lon})">LOCATE</button>
                   <button class="cyber-btn btn-sm" onclick="scanSignal(${m.id})">RECALL</button>`
                : `<button class="cyber-btn btn-sm" onclick="focusMystery(${m.lat}, ${m.lon})">LOCATE</button>
                   <button class="cyber-btn btn-sm" onclick="scanSignal(${m.id})">SCAN</button>`;
            container.innerHTML += `
                <div class="badge-item ${statusClass}">
                    <strong>${statusIcon} ${m.title}</strong>
                </div>
                <div class="mystery-actions">${actionsHtml}</div>
            `;
        });
        document
            .getElementById('mystery-modal')
            .classList.remove('hidden');
    }
    catch(e) {
        console.error(e);
        sysLog(
            "FAILED_TO_LOAD_MYSTERIES",
            "error"
        );
    }
    updateFragmentProgress();
    updateStoryButton();
    updateStoryProgress();
}

//新增mystery解鎖情形marker
function addMysteryMarker(mystery) {
    const isOldChapter = mystery.chapter < currentStoryChapter;
    const markerClass = isOldChapter ? 'anomaly-marker-old' : 'anomaly-marker';
    const anomalyIcon = L.divIcon({
        html: `
            <div class="${markerClass}">
                ◈
            </div>
        `,
        className: '',
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    });
    const marker = L.marker([mystery.lat, mystery.lon],{icon: anomalyIcon}).addTo(map);
    mysteryMarkers.push(marker);
    const statusText = mystery.status === "completed"
        ? "已完成"
        : mystery.status === "unlocked"
            ? "已解鎖"
            : "未解鎖";
    marker.bindPopup(`
        <div class="mystery-popup">
            <h3>${mystery.title}</h3>
            <button onclick="scanSignal(${mystery.id})">
                SCAN_SIGNAL
            </button>
        </div>
    `);
}

//掃描異常地點後得到線索
async function scanSignal(id){
    const mystery =
        mysteryData.find(
            m => m.id === id
        );
    if(!mystery){
        sysLog(
            "SIGNAL_NOT_FOUND",
            "error"
        );
        return;
    }
    const result = await completeMystery(id);
    document.getElementById('scan-result-title').innerText = mystery.title;
    document.getElementById('scan-result-desc').innerText = mystery.description;
    document.getElementById('scan-result-hint').innerText = mystery.hint;
    document.getElementById('scan-result-modal').classList.remove('hidden');
    loadMysteries();

    if (result && result.game_completed) {
        setTimeout(() => {
            document.getElementById('scan-result-modal').classList.add('hidden');
            document.getElementById('victory-modal').classList.remove('hidden');
            playUnlockSound();
            setTimeout(() => playEtherealChime(), 800);
        }, 1500);
    }
}

//讓事件marker可以消失又出現
function showMysteryMarkers() {
    clearMysteryMarkers();
    allMysteryMarkers.forEach(m => {
        addMysteryMarker(m);
    });
}

function getCompletedCount(){

    return mysteryData.filter(
        m => m.status === "completed"
    ).length;
}

async function completeMystery(mysteryId) {
    const response = await fetch(
        `/api/mysteries/${mysteryId}/complete`,
        {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({user_id: currentUserId})
        }
    );
    const data = await response.json();
    if (data.success) {
        sysLog(
            "ANOMALY_RESOLVED",
            "success"
        );
        await loadMysteries();
    } else {
        sysLog(
            data.message || "FAILED",
            "error"
        );
    }
    return data;
}

function focusMystery(lat, lon){
    playClickSound();
    document.getElementById('mystery-modal').classList.add('hidden');
    if (!document.body.classList.contains('parallel-world')) {
        document.body.classList.add('parallel-world');
        updateParallelUI();
    }
    map.flyTo([lat, lon], 17, {duration: 2});
    setTimeout(() => { map.openPopup(); }, 500);
}

function clearMysteryMarkers(){
    mysteryMarkers.forEach(marker=>{
        map.removeLayer(marker);
    });
    mysteryMarkers = [];
}

function updateFragmentProgress(){
    const completed =
        mysteryData.filter(
            m => m.status === "completed"
        ).length;
    const total =
        mysteryData.length;
    document.getElementById(
        "fragment-progress"
    ).innerText =
        `MEMORY_FRAGMENTS ${completed}/${total}`;
}
async function showStoryChapter(
    chapterId
){
    const res = await fetch(`/api/story/${chapterId}`);
    const data = await res.json();
    if(!data.success){ return;}
    const chapter = data.chapter;
    document
        .getElementById("final-anomaly-content")
        .innerHTML = `
            <h2>
                ${chapter.title}
            </h2>
            <p style="
                white-space:pre-line;
            ">
                ${chapter.content}
            </p>
        `;
    document.getElementById("final-anomaly-modal").classList.remove("hidden");
}

async function updateStoryButton() {
    const response = await fetch(
        `/api/story/completed-chapters?user_id=${currentUserId}`
    );
    const data = await response.json();
    const btn = document.getElementById("story-btn");
    const chapterCount =
        data.completed_chapters.length;
    if(chapterCount > 0){
        btn.disabled = false;
        btn.innerText =
            `STORY ARCHIVE (${chapterCount})`;
    }else{
        btn.disabled = true;
        btn.innerText =
            "STORY_LOCKED";
    }
}

function checkFinalAnomaly(){
    const completed =
        mysteryData.filter(
            m => m.status === "completed"
        ).length;
    const total =
        mysteryData.length;
    if(total > 0 &&completed === total){
        const storyChapter =
            mysteryData[0].chapter;
        document
            .getElementById("story-btn")
            .classList
            .remove("hidden");
        document
            .getElementById("story-btn")
            .dataset
            .chapter = storyChapter;
    }
}

async function loadStoryArchive(){
    const container = document.getElementById("story-archive-list");
    container.innerHTML = '';
    const response = await fetch(
        `/api/story/completed-chapters?user_id=${currentUserId}`
    );
    const data = await response.json();
    console.log("archive data:", data);
    console.log("completed chapters:", data.completed_chapters);
    const completedChapters =
        data.completed_chapters || [];
    completedChapters.forEach(chapter => {
        container.innerHTML += `
            <div class="history-item">
                <div class="history-header">
                    <div class="history-title">
                        CHAPTER ${chapter}
                    </div>
                    <button
                        class="cyber-btn btn-sm"
                        onclick="showStoryChapter(${chapter})">
                        OPEN
                    </button>
                </div>
            </div>
        `;})
    document.getElementById("story-archive-modal").classList.remove("hidden");
}