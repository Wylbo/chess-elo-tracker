(function () {
    const MONTHS_TO_FETCH = 6;
    const palette = ['#D19A66', '#C5865B', '#98C379', '#E5C07B', '#E06C75', '#B8B2A7', '#8C8577', '#E6E1DC'];
    const storageKey = 'elo-tracker:v1';
    const players = new Map();
    const pendingPlayers = new Set();
    const listEl = document.getElementById('player-list');
    const statusEl = document.getElementById('status');
    const formEl = document.getElementById('add-form');
    const usernameEl = document.getElementById('username');
    const timeClassEl = document.getElementById('time-class');
    const refreshBtn = document.getElementById('refresh-btn');
    const windowValueEl = document.getElementById('window-value');
    const windowButtons = Array.from(document.querySelectorAll('[data-window]'));
    const playersToggleEl = document.getElementById('players-toggle');
    const playersBodyEl = document.getElementById('players-body');
    const playerCountEl = document.getElementById('player-count');
    const ctx = document.getElementById('elo-chart');
    const DEFAULT_WINDOW = 180;
    const MIN_WINDOW = 7;
    const MAX_WINDOW = 1095;
    const CUSTOM_WINDOW = 'custom';
    let chart = null;
    let colorIndex = 0;
    let domain = { min: null, max: null };
    let windowDays = DEFAULT_WINDOW;
    let playersExpanded = true;
    let colorPickerEl = null;
    let colorPickerPlayer = null;
    let colorPickerAnchor = null;
    let isRefreshing = false;

    // Range selector variables
    const rangeChartCtx = document.getElementById('range-chart');
    const rangeOverlay = document.getElementById('range-overlay');
    let rangeChart = null;
    let rangeSelectorStart = 0;
    let rangeSelectorEnd = 100;
    let isDragging = false;
    let dragMode = null; // 'move', 'left', 'right'
    let dragStartX = 0;
    let dragStartValues = { start: 0, end: 0 };

    init();

    function init() {
        initChart();
        initRangeChart();
        setupColorPicker();
        requestAnimationFrame(() => {
            chart?.resize();
            rangeChart?.resize();
        });
        bindEvents();
        syncWindowUI();
        restoreState();
    }

    function bindEvents() {
        formEl.addEventListener('submit', (event) => {
            event.preventDefault();
            const username = usernameEl.value.trim();
            if (!username) {
                setStatus('Enter a Chess.com username to track.', 'warn');
                return;
            }
            addPlayer(username);
            usernameEl.value = '';
        });

        timeClassEl.addEventListener('change', () => {
            setStatus('Reloading data for ' + timeClassEl.value + '...', 'info');
            refreshAllPlayers();
        });

        refreshBtn.addEventListener('click', handleRefreshClick);

        windowButtons.forEach((btn) => btn.addEventListener('click', () => handleWindowSelect(btn)));
        playersToggleEl.addEventListener('click', togglePlayers);
    }

    function initChart() {
        chart = new Chart(ctx, {
            type: 'line',
            data: { datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 300 },
                scales: {
                    x: {
                        type: 'time',
                        time: { unit: 'week', tooltipFormat: 'MMM d, yyyy' },
                        grid: { color: 'rgba(230,225,220,0.08)' },
                        ticks: { color: '#B8B2A7' }
                    },
                    y: {
                        grid: { color: 'rgba(230,225,220,0.08)' },
                        ticks: { color: '#B8B2A7' }
                    }
                },
                plugins: {
                    legend: { display: true },
                    tooltip: {
                        backgroundColor: '#2B2A28',
                        borderColor: 'rgba(53,50,47,0.7)',
                        borderWidth: 1,
                        padding: 10,
                        callbacks: { label: (ctx) => ctx.dataset.label + ': ' + ctx.formattedValue }
                    }
                },
                interaction: { mode: 'nearest', intersect: false }
            }
        });
    }

    function initRangeChart() {
        rangeChart = new Chart(rangeChartCtx, {
            type: 'line',
            data: { datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 0 },
                scales: {
                    x: {
                        type: 'time',
                        display: false
                    },
                    y: {
                        display: false
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                },
                interaction: { mode: 'nearest', intersect: false }
            }
        });

        // Bind range selector events
        document.addEventListener('mousedown', handleRangeMouseDown);
        document.addEventListener('mousemove', handleRangeMouseMove);
        document.addEventListener('mouseup', handleRangeMouseUp);
    }

    function setupColorPicker() {
        colorPickerEl = document.createElement('div');
        colorPickerEl.className = 'color-picker hidden';

        palette.forEach((color) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'color-swatch';
            btn.style.background = color;
            btn.dataset.color = color;
            btn.title = 'Use ' + color;
            btn.addEventListener('click', (event) => {
                event.stopPropagation();
                applyColorSelection(color);
            });
            colorPickerEl.appendChild(btn);
        });

        document.body.appendChild(colorPickerEl);
        document.addEventListener('click', handleColorPickerDismiss);
        window.addEventListener('resize', closeColorPicker);
        window.addEventListener('scroll', closeColorPicker, true);
    }

    function handleColorPickerDismiss(event) {
        if (!colorPickerEl || colorPickerEl.classList.contains('hidden')) return;
        if (colorPickerEl.contains(event.target)) return;
        if (colorPickerAnchor && colorPickerAnchor.contains(event.target)) return;
        closeColorPicker();
    }

    function setStatus(message, tone = 'info') {
        statusEl.textContent = message;
        statusEl.setAttribute('data-tone', tone);
    }

    function clampWindow(value) {
        const num = parseInt(value, 10);
        if (Number.isNaN(num)) return DEFAULT_WINDOW;
        return Math.min(MAX_WINDOW, Math.max(MIN_WINDOW, num));
    }

    function handleWindowSelect(button) {
        const val = button.dataset.window;
        if (val === 'max') {
            windowDays = null; // null means show all data
        } else {
            windowDays = clampWindow(val);
        }
        syncWindowUI();
        updateChart();
        persistState();
    }

    function syncWindowUI() {
        windowValueEl.textContent = formatWindowLabel(windowDays);

        // Disable buttons whose window would extend before the oldest data
        const endBound = domain.max;
        windowButtons.forEach((btn) => {
            const btnWindow = btn.dataset.window;

            // Always enable the max button
            if (btnWindow === 'max') {
                btn.disabled = false;
            } else if (domain.min && domain.max) {
                // Check if this window would go before the available data
                const daysRequested = parseInt(btnWindow, 10);
                const startBound = new Date(endBound);
                startBound.setDate(startBound.getDate() - daysRequested);

                // Disable if the requested start would be before available data
                btn.disabled = startBound < domain.min;
            } else {
                btn.disabled = false;
            }

            // Update active state
            if (windowDays === CUSTOM_WINDOW) {
                btn.classList.remove('active');
            } else if (windowDays === null) {
                btn.classList.toggle('active', btn.dataset.window === 'max');
            } else {
                const val = parseInt(btn.dataset.window, 10);
                btn.classList.toggle('active', val === windowDays);
            }
        });
    }

    function formatWindowLabel(days) {
        if (days === CUSTOM_WINDOW) return 'custom range';
        if (days === null) return 'all time';
        const map = {
            7: '1 week',
            30: '1 month',
            90: '3 months',
            180: '6 months',
            365: '1 year'
        };
        return map[days] || days + ' days';
    }

    function pickColor(preferred) {
        if (preferred) return preferred;
        const color = palette[colorIndex % palette.length];
        colorIndex += 1;
        return color;
    }

    function persistState() {
        const snapshot = {
            timeClass: timeClassEl.value,
            playersExpanded,
            windowDays,
            players: Array.from(players.values()).map((p) => ({
                username: p.username,
                visible: p.visible,
                color: p.color
            }))
        };
        try {
            localStorage.setItem(storageKey, JSON.stringify(snapshot));
        } catch (err) {
            console.warn('Could not persist state', err);
        }
    }

    async function restoreState() {
        let saved = null;
        try {
            saved = JSON.parse(localStorage.getItem(storageKey));
        } catch (err) {
            saved = null;
        }

        if (saved?.timeClass) {
            timeClassEl.value = saved.timeClass;
        }

        if (saved?.windowDays) {
            windowDays = clampWindow(saved.windowDays);
            syncWindowUI();
        }

        if (typeof saved?.playersExpanded === 'boolean') {
            playersExpanded = saved.playersExpanded;
            applyPlayersCollapse({ animate: false });
        }

        if (saved?.players?.length) {
            setStatus('Restoring ' + saved.players.length + ' saved players...', 'info');
            resetPendingPlayers(saved.players.map((entry) => entry.username));
            for (const entry of saved.players) {
                await addPlayer(entry.username, {
                    silent: true,
                    visible: entry.visible !== false,
                    preferredColor: entry.color,
                    forceRefresh: true
                });
            }
            setStatus('Restored saved players.', 'success');
        } else {
            applyPlayersCollapse({ animate: false });
        }
    }

    async function refreshAllPlayers(options = {}) {
        const snapshots = Array.from(players.values()).map((p) => ({
            username: p.username,
            displayName: p.displayName,
            visible: p.visible,
            color: p.color
        }));
        players.clear();
        domain = { min: null, max: null };
        if (options.resetWindow !== false) {
            windowDays = DEFAULT_WINDOW; // Reset window when changing time class
        }
        resetPendingPlayers(snapshots.map((entry) => entry.username));
        updateChart();
        persistState();

        for (const entry of snapshots) {
            await addPlayer(entry.displayName || entry.username, {
                silent: true,
                forceRefresh: true,
                preferredColor: entry.color,
                visible: entry.visible
            });
        }
        if (snapshots.length) {
            setStatus('Updated ' + snapshots.length + ' players for ' + timeClassEl.value + '.', 'success');
        }
        computeDomain();
        syncWindowUI();
    }

    async function handleRefreshClick() {
        if (isRefreshing) return;
        if (!players.size) {
            setStatus('Add players to refresh their data.', 'warn');
            return;
        }

        isRefreshing = true;
        refreshBtn.disabled = true;
        const originalText = refreshBtn.textContent;
        refreshBtn.textContent = 'Refreshing...';
        setStatus('Refreshing tracked players...', 'info');

        try {
            await refreshAllPlayers({ resetWindow: false });
            setStatus('Player data refreshed.', 'success');
        } finally {
            refreshBtn.disabled = false;
            refreshBtn.textContent = originalText;
            isRefreshing = false;
        }
    }

    async function addPlayer(rawName, options = {}) {
        const username = rawName.trim().toLowerCase();
        if (!username) return;

        const existing = players.get(username);
        if (existing && !options.forceRefresh) {
            existing.visible = options.visible ?? true;
            existing.disabled = options.disabled ?? existing.disabled ?? false;
            renderList();
            updateChart();
            persistState();
            return;
        }

        const display = rawName.trim();
        const color = pickColor(options.preferredColor || existing?.color);
        const visible = options.visible !== undefined ? options.visible : true;

        queuePendingPlayer(username);
        try {
            if (!options.silent) setStatus('Fetching ' + display + ' ' + timeClassEl.value + ' games...', 'info');
            const points = await fetchRatings(username, timeClassEl.value);
            if (!points.length) {
                players.set(username, {
                    username,
                    displayName: display,
                    color,
                    data: [],
                    visible: false,
                    disabled: true
                });
                resolvePendingPlayer(username);
                renderList();
                updateChart();
                persistState();
                if (!options.silent) {
                    setStatus(display + ' has no ' + timeClassEl.value + ' games recently. Disabled for this time control.', 'warn');
                }
                return;
            }
            players.set(username, { username, displayName: display, color, data: points, visible, disabled: false });
            updateDomainWith(points);
            resolvePendingPlayer(username);
            renderList();
            updateChart();
            persistState();
            if (!options.silent) setStatus('Added ' + display, 'success');
        } catch (err) {
            console.error(err);
            resolvePendingPlayer(username);
            renderList();
            setStatus(err.message || 'Unable to fetch data for ' + display + '.', 'error');
        }
    }

    async function fetchRatings(username, timeClass) {
        const archivesRes = await fetch('https://api.chess.com/pub/player/' + username + '/games/archives');
        if (!archivesRes.ok) throw new Error('Could not find ' + username + ' on Chess.com.');

        const archiveData = await archivesRes.json();
        const archives = archiveData.archives?.slice(-MONTHS_TO_FETCH) || [];
        const dailyMap = new Map();

        for (const archiveUrl of archives.reverse()) {
            try {
                const res = await fetch(archiveUrl);
                if (!res.ok) continue;
                const { games } = await res.json();
                (games || []).forEach((game) => {
                    if (game.time_class !== timeClass) return;
                    const lowerWhite = game.white?.username?.toLowerCase();
                    const lowerBlack = game.black?.username?.toLowerCase();
                    const isWhite = lowerWhite === username;
                    const isBlack = lowerBlack === username;
                    if (!isWhite && !isBlack) return;
                    const rating = isWhite ? game.white?.rating : game.black?.rating;
                    if (!rating) return;
                    const ts = game.end_time || game.start_time;
                    if (!ts) return;
                    const date = new Date(ts * 1000);
                    const key = date.toISOString().slice(0, 10);
                    dailyMap.set(key, { date: new Date(key), rating });
                });
            } catch (err) {
                console.warn('Archive fetch failed for', archiveUrl, err);
            }
        }

        try {
            const statsRes = await fetch('https://api.chess.com/pub/player/' + username + '/stats');
            if (statsRes.ok) {
                const stats = await statsRes.json();
                const key = 'chess_' + timeClass;
                const lastRating = stats[key]?.last?.rating;
                if (lastRating) {
                    const today = new Date();
                    const todayKey = today.toISOString().slice(0, 10);
                    dailyMap.set(todayKey, { date: new Date(todayKey), rating: lastRating });
                }
            }
        } catch (err) {
            console.warn('Stats fetch failed for', username, err);
        }

        const points = Array.from(dailyMap.values()).sort((a, b) => a.date - b.date);
        updateDomainWith(points);
        return points;
    }

    function updateDomainWith(points) {
        if (!points?.length) return;
        const first = points[0].date;
        const last = points[points.length - 1].date;
        if (!domain.min || first < domain.min) domain.min = first;
        if (!domain.max || last > domain.max) domain.max = last;
    }

    function summarizePlayer(player) {
        const data = player?.data || [];
        if (!data.length) return { rating: null, delta: null, direction: 'flat' };
        const latest = data[data.length - 1].rating;
        const prev = data.length > 1 ? data[data.length - 2].rating : null;
        const delta = prev !== null ? latest - prev : null;
        let direction = 'flat';
        if (delta > 0) direction = 'up';
        else if (delta < 0) direction = 'down';
        return { rating: latest, delta, direction };
    }

    function renderList() {
        listEl.innerHTML = '';
        if (!players.size && !pendingPlayers.size) {
            listEl.innerHTML = '<div class="player-sub">No players yet. Add a Chess.com username to start tracking.</div>';
            updatePlayerCount();
            return;
        }

        players.forEach((player) => {
            const row = document.createElement('div');
            row.className = 'player-row' + (player.disabled ? ' disabled' : '');

            const dot = document.createElement('div');
            dot.className = 'dot';
            dot.style.background = player.color;
            dot.title = 'Change ' + player.displayName + ' color';
            dot.setAttribute('role', 'button');
            dot.tabIndex = player.disabled ? -1 : 0;
            dot.addEventListener('click', (event) => {
                event.stopPropagation();
                if (player.disabled) return;
                openColorPicker(player, dot);
            });
            dot.addEventListener('keydown', (event) => {
                if (player.disabled) return;
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openColorPicker(player, dot);
                }
            });
            row.appendChild(dot);

            const meta = document.createElement('div');
            meta.className = 'player-meta';
            const name = document.createElement('div');
            name.className = 'player-name';
            name.textContent = player.displayName;
            const sub = document.createElement('div');
            sub.className = 'player-sub';
            if (player.disabled) {
                sub.textContent = 'No ' + timeClassEl.value + ' games (disabled)';
            } else {
                const { rating, delta, direction } = summarizePlayer(player);
                const trendSpan = document.createElement('span');
                trendSpan.className = 'player-trend trend-' + direction;
                const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→';
                const deltaText = delta === null ? 'new' : delta === 0 ? '0' : (delta > 0 ? '+' : '') + delta;
                trendSpan.textContent = arrow + ' ' + deltaText;

                const ratingSpan = document.createElement('span');
                ratingSpan.className = 'player-rating';
                ratingSpan.textContent = rating != null ? rating + ' ELO' : 'No rating yet';

                const timeClassSpan = document.createElement('span');
                timeClassSpan.className = 'player-time-class';
                timeClassSpan.textContent = '· ' + timeClassEl.value;

                sub.appendChild(ratingSpan);
                sub.appendChild(trendSpan);
                sub.appendChild(timeClassSpan);
            }
            meta.appendChild(name);
            meta.appendChild(sub);
            row.appendChild(meta);

            const toggle = document.createElement('label');
            toggle.className = 'toggle';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = player.visible && !player.disabled;
            input.disabled = !!player.disabled;
            input.addEventListener('change', () => {
                player.visible = input.checked;
                updateChart();
                persistState();
            });
            const slider = document.createElement('span');
            slider.className = 'slider';
            toggle.appendChild(input);
            toggle.appendChild(slider);
            row.appendChild(toggle);

            const removeBtn = document.createElement('button');
            removeBtn.className = 'ghost-btn';
            removeBtn.type = 'button';
            removeBtn.textContent = 'Remove';
            removeBtn.addEventListener('click', () => {
                players.delete(player.username);
                renderList();
                updateChart();
                persistState();
            });
            row.appendChild(removeBtn);

            listEl.appendChild(row);
        });

        pendingPlayers.forEach(() => {
            const row = document.createElement('div');
            row.className = 'player-row placeholder';
            row.setAttribute('aria-hidden', 'true');
            listEl.appendChild(row);
        });
        updatePlayerCount();
    }

    function openColorPicker(player, anchorEl) {
        if (!colorPickerEl) return;
        colorPickerPlayer = player;
        colorPickerAnchor = anchorEl;

        const rect = anchorEl.getBoundingClientRect();
        colorPickerEl.style.left = rect.left + window.scrollX + 'px';
        colorPickerEl.style.top = rect.bottom + window.scrollY + 8 + 'px';

        colorPickerEl.querySelectorAll('.color-swatch').forEach((btn) => {
            const isActive = btn.dataset.color === player.color;
            btn.classList.toggle('active', isActive);
        });

        colorPickerEl.classList.remove('hidden');
    }

    function closeColorPicker() {
        if (!colorPickerEl) return;
        colorPickerEl.classList.add('hidden');
        colorPickerPlayer = null;
        colorPickerAnchor = null;
    }

    function applyColorSelection(color) {
        if (!colorPickerPlayer) return;
        colorPickerPlayer.color = color;
        closeColorPicker();
        renderList();
        updateChart();
        persistState();
    }

    function updatePlayerCount() {
        playerCountEl.textContent = players.size + pendingPlayers.size;
    }

    function queuePendingPlayer(username) {
        if (!username || pendingPlayers.has(username)) return;
        pendingPlayers.add(username);
        renderList();
    }

    function resolvePendingPlayer(username) {
        if (!username) return;
        pendingPlayers.delete(username);
    }

    function resetPendingPlayers(usernames = []) {
        pendingPlayers.clear();
        usernames.forEach((username) => {
            if (username) pendingPlayers.add(username.toLowerCase());
        });
        renderList();
    }

    function togglePlayers() {
        playersExpanded = !playersExpanded;
        applyPlayersCollapse();
        persistState();
    }

    function applyPlayersCollapse(options = {}) {
        const { animate = true } = options;
        const isExpanded = playersExpanded;

        playersToggleEl.setAttribute('aria-expanded', isExpanded);
        playersToggleEl.querySelector('.chevron').textContent = isExpanded ? 'v' : '>';

        if (playersBodyEl._collapseHandler) {
            playersBodyEl.removeEventListener('transitionend', playersBodyEl._collapseHandler);
            playersBodyEl._collapseHandler = null;
        }

        if (!animate) {
            playersBodyEl.style.transition = 'none';
            playersBodyEl.classList.toggle('collapsed', !isExpanded);
            playersBodyEl.style.height = isExpanded ? 'auto' : '0px';
            playersBodyEl.style.opacity = isExpanded ? '1' : '0';
            playersBodyEl.offsetHeight;
            playersBodyEl.style.transition = '';
            return;
        }

        const startHeight = playersBodyEl.getBoundingClientRect().height;
        const endHeight = isExpanded ? playersBodyEl.scrollHeight : 0;

        if (isExpanded) {
            playersBodyEl.classList.remove('collapsed');
        }

        playersBodyEl.style.height = startHeight + 'px';
        playersBodyEl.style.opacity = isExpanded ? '0' : '1';
        playersBodyEl.offsetHeight;

        const onEnd = (event) => {
            if (event.propertyName !== 'height') return;
            playersBodyEl.removeEventListener('transitionend', onEnd);
            playersBodyEl._collapseHandler = null;
            if (isExpanded) {
                playersBodyEl.style.height = 'auto';
                playersBodyEl.style.opacity = '1';
            } else {
                playersBodyEl.classList.add('collapsed');
                playersBodyEl.style.height = '0px';
                playersBodyEl.style.opacity = '0';
            }
        };

        playersBodyEl._collapseHandler = onEnd;
        playersBodyEl.addEventListener('transitionend', onEnd);

        requestAnimationFrame(() => {
            playersBodyEl.style.height = endHeight + 'px';
            playersBodyEl.style.opacity = isExpanded ? '1' : '0';
        });
    }

    function buildWindowedSeries(points, startBound, endBound) {
        if (!points?.length) return [];
        const inRange = [];
        let carry = null;
        let nextPoint = null;

        for (const point of points) {
            if (point.date < startBound) {
                carry = point;
                continue;
            }
            if (point.date > endBound) {
                nextPoint = point;
                break;
            }
            inRange.push(point);
        }

        // If there are no points in range but we have points before and after, draw a line between them
        if (inRange.length === 0 && carry && nextPoint) {
            return [
                { x: new Date(startBound), y: carry.rating },
                { x: new Date(endBound), y: nextPoint.rating }
            ];
        }

        // If the player has a rating before the visible window, anchor the line to the window start.
        if (carry && inRange.length) {
            inRange.unshift({ date: new Date(startBound), rating: carry.rating });
        }

        // If the player has a rating after the visible window, anchor the line to the window end.
        if (nextPoint && inRange.length) {
            inRange.push({ date: new Date(endBound), rating: nextPoint.rating });
        }

        return inRange.map((p) => ({ x: p.date, y: p.rating }));
    }

    function updateChart() {
        computeDomain();
        if (!players.size || !domain.min || !domain.max) {
            domain = { min: null, max: null };
            chart.options.scales.x.min = undefined;
            chart.options.scales.x.max = undefined;
            chart.data.datasets = [];
            chart.update('none');
            rangeChart.data.datasets = [];
            rangeChart.update('none');
            syncWindowUI();
            return;
        }
        const datasets = [];
        const endBound = new Date(domain.max);
        let startBound;

        if (windowDays === CUSTOM_WINDOW) {
            const totalTimeSpan = domain.max.getTime() - domain.min.getTime();
            startBound = new Date(domain.min.getTime() + (totalTimeSpan * rangeSelectorStart / 100));
            endBound.setTime(domain.min.getTime() + (totalTimeSpan * rangeSelectorEnd / 100));
        } else if (windowDays === null) {
            // Show all data
            startBound = domain.min;
        } else {
            startBound = new Date(endBound);
            startBound.setDate(startBound.getDate() - windowDays);
        }

        players.forEach((player) => {
            if (!player.visible || player.disabled || !player.data?.length) return;
            const data = buildWindowedSeries(player.data, startBound, endBound);
            if (!data.length) return;
            datasets.push({
                label: player.displayName,
                data,
                borderColor: player.color,
                backgroundColor: player.color + '33',
                tension: 0.32,
                borderWidth: 2.5,
                pointRadius: 3,
                pointHoverRadius: 5,
                fill: false,
                spanGaps: true
            });
        });

        chart.options.scales.x.min = startBound || undefined;
        chart.options.scales.x.max = endBound || undefined;
        chart.data.datasets = datasets;
        chart.update('active');

        // Update range selector position (only if not actively dragging)
        if (!isDragging) {
            const totalTimeSpan = domain.max.getTime() - domain.min.getTime();
            rangeSelectorStart = ((startBound.getTime() - domain.min.getTime()) / totalTimeSpan) * 100;
            rangeSelectorEnd = ((endBound.getTime() - domain.min.getTime()) / totalTimeSpan) * 100;
        }
        updateRangeOverlay();
        updateRangeChart();

        syncWindowUI();
    }

    function computeDomain() {
        let min = null;
        let max = null;
        players.forEach((p) => {
            if (!p.data?.length) return;
            const first = p.data[0].date;
            const last = p.data[p.data.length - 1].date;
            if (!min || first < min) min = first;
            if (!max || last > max) max = last;
        });
        domain = { min, max };
    }

    function updateRangeChart() {
        if (!players.size || !domain.min || !domain.max) {
            rangeChart.data.datasets = [];
            rangeChart.update('none');
            rangeOverlay.style.left = '0%';
            rangeOverlay.style.width = '100%';
            return;
        }

        const datasets = [];
        players.forEach((player) => {
            if (!player.visible || player.disabled) return;
            if (!player.data?.length) return;
            const data = player.data.map((p) => ({ x: p.date, y: p.rating }));
            datasets.push({
                label: player.displayName,
                data,
                borderColor: player.color,
                backgroundColor: player.color + '33',
                tension: 0.32,
                borderWidth: 1.5,
                pointRadius: 0,
                pointHoverRadius: 0,
                fill: false,
                spanGaps: true
            });
        });

        rangeChart.options.scales.x.min = domain.min;
        rangeChart.options.scales.x.max = domain.max;
        rangeChart.data.datasets = datasets;
        rangeChart.update('none');
        updateRangeOverlay();
    }

    function updateRangeOverlay() {
        const overlayWidth = rangeSelectorEnd - rangeSelectorStart;
        rangeOverlay.style.left = rangeSelectorStart + '%';
        rangeOverlay.style.width = overlayWidth + '%';
    }

    function handleRangeMouseDown(e) {
        if (!rangeChart || !domain.min || !domain.max) return;

        const rangeWrap = rangeOverlay.parentElement;
        const rect = rangeWrap.getBoundingClientRect();

        // Only allow dragging if the click is within the range selector area
        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
            return;
        }

        const x = e.clientX - rect.left;
        const percentX = (x / rect.width) * 100;

        dragStartX = e.clientX;
        dragStartValues = { start: rangeSelectorStart, end: rangeSelectorEnd };

        // Determine drag mode - edges have priority when very close
        const distToStart = Math.abs(percentX - rangeSelectorStart);
        const distToEnd = Math.abs(percentX - rangeSelectorEnd);
        const edgeThreshold = 1; // No threshold - must click exactly on edge

        if (distToStart <= edgeThreshold) {
            dragMode = 'left';
        } else if (distToEnd <= edgeThreshold) {
            dragMode = 'right';
        } else if (percentX >= rangeSelectorStart && percentX <= rangeSelectorEnd) {
            dragMode = 'move';
        }

        if (dragMode) {
            isDragging = true;
            rangeOverlay.classList.add('dragging');
        }
    }

    function handleRangeMouseMove(e) {
        if (!isDragging || !dragMode) return;

        const rect = rangeOverlay.parentElement.getBoundingClientRect();
        const deltaX = e.clientX - dragStartX;
        const deltaPercent = (deltaX / rect.width) * 100;

        if (dragMode === 'move') {
            const width = dragStartValues.end - dragStartValues.start;
            let newStart = dragStartValues.start + deltaPercent;
            let newEnd = dragStartValues.end + deltaPercent;

            newStart = Math.max(0, Math.min(newStart, 100 - width));
            newEnd = newStart + width;

            rangeSelectorStart = newStart;
            rangeSelectorEnd = newEnd;
        } else if (dragMode === 'left') {
            let newStart = dragStartValues.start + deltaPercent;
            newStart = Math.max(0, Math.min(newStart, rangeSelectorEnd));
            rangeSelectorStart = newStart;
        } else if (dragMode === 'right') {
            let newEnd = dragStartValues.end + deltaPercent;
            newEnd = Math.min(100, Math.max(newEnd, rangeSelectorStart));
            rangeSelectorEnd = newEnd;
        }

        updateRangeOverlay();
        applyRangeSelection();
    }

    function handleRangeMouseUp() {
        if (isDragging) {
            isDragging = false;
            dragMode = null;
            rangeOverlay.classList.remove('dragging');
        }
    }

    function applyRangeSelection() {
        if (!domain.min || !domain.max) return;
        windowDays = CUSTOM_WINDOW;

        const timeSpan = domain.max.getTime() - domain.min.getTime();
        const selectedStart = new Date(domain.min.getTime() + (timeSpan * rangeSelectorStart / 100));
        const selectedEnd = new Date(domain.min.getTime() + (timeSpan * rangeSelectorEnd / 100));

        // Build datasets for the selected range
        const datasets = [];
        players.forEach((player) => {
            if (!player.visible || player.disabled || !player.data?.length) return;
            const data = buildWindowedSeries(player.data, selectedStart, selectedEnd);
            if (!data.length) return;
            datasets.push({
                label: player.displayName,
                data,
                borderColor: player.color,
                backgroundColor: player.color + '33',
                tension: 0.32,
                borderWidth: 2.5,
                pointRadius: 3,
                pointHoverRadius: 5,
                fill: false,
                spanGaps: true
            });
        });

        // Update chart with selected range
        chart.options.scales.x.min = selectedStart;
        chart.options.scales.x.max = selectedEnd;
        chart.data.datasets = datasets;
        chart.update('active');

        syncWindowUI();
        persistState();
    }

    // =============================================
    // WEEKLY BEST/WORST GAMES SECTION
    // =============================================

    const gamesStore = new Map(); // username -> { games: [], lastFetched: timestamp }
    const weeklyTableBodyEl = document.getElementById('weekly-table-body');
    const weeklyStatusEl = document.getElementById('weekly-status');
    const analysisProgressEl = document.getElementById('analysis-progress');
    const analysisProgressBarEl = document.getElementById('analysis-progress-bar');
    const weeklyToggleEl = document.getElementById('weekly-toggle');
    const weeklyBodyEl = document.getElementById('weekly-body');
    const modalOverlayEl = document.getElementById('game-modal-overlay');
    const modalCloseEl = document.getElementById('modal-close');
    const modalPlayersEl = document.getElementById('modal-players');
    const modalResultEl = document.getElementById('modal-result');
    const modalAccuracyEl = document.getElementById('modal-accuracy');
    const moveCounterEl = document.getElementById('move-counter');
    const moveListEl = document.getElementById('move-list');
    const viewOnChesscomEl = document.getElementById('view-on-chesscom');

    let chessBoard = null;
    let chessGame = null;
    let currentMoveIndex = 0;
    let gameMoves = [];
    let gameHistory = [];
    let playbackInterval = null;
    let weeklyExpanded = true;
    let currentGameData = null;

    // Analysis queue for Stockfish
    const analysisQueue = [];
    let isAnalyzing = false;
    let stockfishWorker = null;
    let stockfishReady = false;
    let stockfishResolve = null;
    let totalGamesToAnalyze = 0;
    let gamesAnalyzed = 0;
    const STOCKFISH_DEPTH = 12; // Depth for analysis (balance between accuracy and speed)

    // Initialize weekly games section
    initWeeklyGames();
    initStockfish();

    function initStockfish() {
        try {
            // Use the stockfish.js from CDN as a Web Worker
            stockfishWorker = new Worker('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js');

            stockfishWorker.onmessage = function(event) {
                const line = event.data;

                if (line === 'uciok') {
                    stockfishReady = true;
                    console.log('Stockfish ready');
                }

                // Parse evaluation from info lines
                if (stockfishResolve && line.startsWith('info depth')) {
                    const depthMatch = line.match(/depth (\d+)/);
                    const depth = depthMatch ? parseInt(depthMatch[1]) : 0;

                    if (depth >= STOCKFISH_DEPTH) {
                        // Extract centipawn score or mate score
                        const cpMatch = line.match(/score cp (-?\d+)/);
                        const mateMatch = line.match(/score mate (-?\d+)/);

                        if (cpMatch) {
                            stockfishResolve({ type: 'cp', value: parseInt(cpMatch[1]) });
                            stockfishResolve = null;
                        } else if (mateMatch) {
                            // Convert mate to centipawns (mate in N = ±10000)
                            const mateIn = parseInt(mateMatch[1]);
                            stockfishResolve({ type: 'mate', value: mateIn > 0 ? 10000 : -10000 });
                            stockfishResolve = null;
                        }
                    }
                }

                // Handle bestmove as fallback
                if (stockfishResolve && line.startsWith('bestmove')) {
                    // If we get bestmove without a score, return neutral
                    stockfishResolve({ type: 'cp', value: 0 });
                    stockfishResolve = null;
                }
            };

            stockfishWorker.onerror = function(err) {
                console.error('Stockfish worker error:', err);
                stockfishReady = false;
            };

            // Initialize UCI
            stockfishWorker.postMessage('uci');
        } catch (err) {
            console.error('Failed to initialize Stockfish:', err);
        }
    }

    function evaluatePosition(fen) {
        return new Promise((resolve, reject) => {
            if (!stockfishWorker || !stockfishReady) {
                reject(new Error('Stockfish not ready'));
                return;
            }

            stockfishResolve = resolve;

            // Set position and start analysis
            stockfishWorker.postMessage('position fen ' + fen);
            stockfishWorker.postMessage('go depth ' + STOCKFISH_DEPTH);

            // Timeout after 10 seconds
            setTimeout(() => {
                if (stockfishResolve) {
                    stockfishResolve = null;
                    reject(new Error('Evaluation timeout'));
                }
            }, 10000);
        });
    }

    function initWeeklyGames() {
        weeklyToggleEl?.addEventListener('click', toggleWeeklySection);
        modalCloseEl?.addEventListener('click', closeGameModal);
        modalOverlayEl?.addEventListener('click', (e) => {
            if (e.target === modalOverlayEl) closeGameModal();
        });

        // Playback controls
        document.getElementById('btn-start')?.addEventListener('click', () => goToMove(0));
        document.getElementById('btn-prev')?.addEventListener('click', () => goToMove(currentMoveIndex - 1));
        document.getElementById('btn-play')?.addEventListener('click', togglePlayback);
        document.getElementById('btn-next')?.addEventListener('click', () => goToMove(currentMoveIndex + 1));
        document.getElementById('btn-end')?.addEventListener('click', () => goToMove(gameMoves.length));

        // Keyboard navigation for modal
        document.addEventListener('keydown', handleModalKeydown);
    }

    function handleModalKeydown(e) {
        if (modalOverlayEl?.classList.contains('hidden')) return;
        if (e.key === 'Escape') closeGameModal();
        if (e.key === 'ArrowLeft') goToMove(currentMoveIndex - 1);
        if (e.key === 'ArrowRight') goToMove(currentMoveIndex + 1);
        if (e.key === 'Home') goToMove(0);
        if (e.key === 'End') goToMove(gameMoves.length);
        if (e.key === ' ') {
            e.preventDefault();
            togglePlayback();
        }
    }

    function toggleWeeklySection() {
        weeklyExpanded = !weeklyExpanded;
        applyWeeklyCollapse();
    }

    function applyWeeklyCollapse(options = {}) {
        const { animate = true } = options;
        const isExpanded = weeklyExpanded;

        weeklyToggleEl?.setAttribute('aria-expanded', isExpanded);
        const chevron = weeklyToggleEl?.querySelector('.chevron');
        if (chevron) chevron.textContent = isExpanded ? 'v' : '>';

        if (!weeklyBodyEl) return;

        if (!animate) {
            weeklyBodyEl.style.transition = 'none';
            weeklyBodyEl.classList.toggle('collapsed', !isExpanded);
            weeklyBodyEl.style.height = isExpanded ? 'auto' : '0px';
            weeklyBodyEl.style.opacity = isExpanded ? '1' : '0';
            weeklyBodyEl.offsetHeight;
            weeklyBodyEl.style.transition = '';
            return;
        }

        const startHeight = weeklyBodyEl.getBoundingClientRect().height;
        const endHeight = isExpanded ? weeklyBodyEl.scrollHeight : 0;

        if (isExpanded) weeklyBodyEl.classList.remove('collapsed');

        weeklyBodyEl.style.height = startHeight + 'px';
        weeklyBodyEl.style.opacity = isExpanded ? '0' : '1';
        weeklyBodyEl.offsetHeight;

        requestAnimationFrame(() => {
            weeklyBodyEl.style.height = endHeight + 'px';
            weeklyBodyEl.style.opacity = isExpanded ? '1' : '0';
        });

        const onEnd = (event) => {
            if (event.propertyName !== 'height') return;
            weeklyBodyEl.removeEventListener('transitionend', onEnd);
            if (isExpanded) {
                weeklyBodyEl.style.height = 'auto';
            } else {
                weeklyBodyEl.classList.add('collapsed');
            }
        };
        weeklyBodyEl.addEventListener('transitionend', onEnd);
    }

    async function fetchWeeklyGamesForPlayer(username, timeClass) {
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

        // Check cache
        const cached = gamesStore.get(username);
        if (cached && cached.timeClass === timeClass && Date.now() - cached.lastFetched < 300000) {
            return cached.games;
        }

        try {
            const archivesRes = await fetch('https://api.chess.com/pub/player/' + username + '/games/archives');
            if (!archivesRes.ok) return [];

            const archiveData = await archivesRes.json();
            const archives = archiveData.archives?.slice(-2) || []; // Last 2 months should cover a week

            const games = [];
            for (const archiveUrl of archives.reverse()) {
                try {
                    const res = await fetch(archiveUrl);
                    if (!res.ok) continue;
                    const data = await res.json();

                    for (const game of (data.games || [])) {
                        if (game.time_class !== timeClass) continue;

                        const ts = (game.end_time || game.start_time) * 1000;
                        if (ts < sevenDaysAgo) continue;

                        const lowerWhite = game.white?.username?.toLowerCase();
                        const lowerBlack = game.black?.username?.toLowerCase();
                        const isWhite = lowerWhite === username;
                        const isBlack = lowerBlack === username;
                        if (!isWhite && !isBlack) continue;

                        const userColor = isWhite ? 'white' : 'black';
                        const opponent = isWhite ? game.black : game.white;
                        const userSide = isWhite ? game.white : game.black;

                        // Determine result
                        let result = 'draw';
                        if (userSide?.result === 'win') result = 'win';
                        else if (opponent?.result === 'win') result = 'loss';

                        // Get accuracy if available from Chess.com
                        const accuracy = game.accuracies?.[userColor] || null;

                        games.push({
                            url: game.url,
                            pgn: game.pgn,
                            endTime: ts,
                            timeClass: game.time_class,
                            userColor,
                            username: username,
                            userRating: userSide?.rating,
                            opponentUsername: opponent?.username,
                            opponentRating: opponent?.rating,
                            result,
                            accuracy,
                            analysisStatus: accuracy != null ? 'complete' : 'pending'
                        });
                    }
                } catch (err) {
                    console.warn('Failed to fetch archive', archiveUrl, err);
                }
            }

            // Sort by end time descending
            games.sort((a, b) => b.endTime - a.endTime);

            gamesStore.set(username, {
                games,
                timeClass,
                lastFetched: Date.now()
            });

            return games;
        } catch (err) {
            console.error('Failed to fetch weekly games for', username, err);
            return [];
        }
    }

    function findBestWorstGames(games) {
        const gamesWithAccuracy = games.filter(g => g.accuracy != null);

        if (gamesWithAccuracy.length === 0) {
            return { best: null, worst: null };
        }

        let best = gamesWithAccuracy[0];
        let worst = gamesWithAccuracy[0];

        for (const game of gamesWithAccuracy) {
            if (game.accuracy > best.accuracy) best = game;
            if (game.accuracy < worst.accuracy) worst = game;
        }

        // Don't return the same game for both if there's only one
        if (gamesWithAccuracy.length === 1) {
            return { best, worst: null };
        }

        return { best, worst };
    }

    async function updateWeeklyGames() {
        if (!players.size) {
            weeklyStatusEl.textContent = 'Add players to see their best and worst games from the last 7 days.';
            weeklyStatusEl.setAttribute('data-tone', 'info');
            weeklyTableBodyEl.innerHTML = '';
            return;
        }

        weeklyStatusEl.textContent = 'Loading weekly games...';
        weeklyStatusEl.setAttribute('data-tone', 'info');

        const timeClass = timeClassEl.value;
        const playerEntries = Array.from(players.values());

        // Fetch games for all players
        for (const player of playerEntries) {
            await fetchWeeklyGamesForPlayer(player.username, timeClass);
        }

        // Queue games without Chess.com accuracy for Stockfish analysis
        gamesAnalyzed = 0;
        totalGamesToAnalyze = 0;

        for (const player of playerEntries) {
            const cached = gamesStore.get(player.username);
            const games = cached?.games || [];
            for (const game of games) {
                if (game.accuracy == null && game.analysisStatus !== 'analyzing' && game.analysisStatus !== 'failed') {
                    queueForAnalysis(game, player.username);
                    totalGamesToAnalyze++;
                }
            }
        }

        renderWeeklyTable();

        // Start processing analysis queue
        processAnalysisQueue();
    }

    function queueForAnalysis(game, username) {
        if (analysisQueue.some(q => q.game.url === game.url)) return;
        analysisQueue.push({ game, username });
    }

    async function processAnalysisQueue() {
        if (isAnalyzing || analysisQueue.length === 0) return;
        if (!stockfishReady) {
            console.log('Stockfish not ready yet, waiting...');
            setTimeout(() => processAnalysisQueue(), 1000);
            return;
        }

        isAnalyzing = true;

        while (analysisQueue.length > 0) {
            const { game } = analysisQueue.shift();

            // Skip if already has Chess.com accuracy or already analyzed
            if (game.accuracy != null || game.analysisStatus === 'complete') {
                gamesAnalyzed++;
                continue;
            }

            game.analysisStatus = 'analyzing';
            renderWeeklyTable(); // Show "Analyzing..." status

            try {
                const accuracy = await analyzeGameWithStockfish(game);
                if (accuracy != null) {
                    game.accuracy = accuracy;
                    game.analysisStatus = 'complete';
                } else {
                    game.analysisStatus = 'failed';
                }
            } catch (err) {
                console.warn('Stockfish analysis failed for game', game.url, err);
                game.analysisStatus = 'failed';
            }

            gamesAnalyzed++;

            // Update table after each analysis
            renderWeeklyTable();
        }

        isAnalyzing = false;
    }

    async function analyzeGameWithStockfish(game) {
        if (!game.pgn || !stockfishReady) return null;

        try {
            const moves = [];

            // Extract moves from PGN
            const pgnLines = game.pgn.split('\n');
            let moveText = '';
            for (const line of pgnLines) {
                if (!line.startsWith('[')) {
                    moveText += ' ' + line;
                }
            }

            // Parse move text
            const moveRegex = /(\d+\.+\s*)?([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?|O-O-O|O-O)([+#])?/g;
            let match;
            while ((match = moveRegex.exec(moveText)) !== null) {
                moves.push(match[2]);
            }

            if (moves.length === 0) return null;

            const isUserWhite = game.userColor === 'white';
            const evaluations = [];
            const tempChess = new Chess();

            // Get evaluation for starting position
            try {
                const startEval = await evaluatePosition(tempChess.fen());
                evaluations.push(startEval.value);
            } catch (e) {
                evaluations.push(0);
            }

            // Play through each move and evaluate
            for (let i = 0; i < moves.length; i++) {
                try {
                    tempChess.move(moves[i]);
                    const evalResult = await evaluatePosition(tempChess.fen());
                    evaluations.push(evalResult.value);
                } catch (e) {
                    // If move fails or eval fails, use previous eval
                    evaluations.push(evaluations[evaluations.length - 1] || 0);
                }
            }

            // Calculate centipawn loss for each of the user's moves
            let totalLoss = 0;
            let userMoves = 0;

            for (let i = 0; i < moves.length; i++) {
                // Check if this was the user's move
                // Move 0 (first move) is white's, move 1 is black's, etc.
                const isWhiteMove = i % 2 === 0;
                const isUserMove = (isWhiteMove && isUserWhite) || (!isWhiteMove && !isUserWhite);

                if (!isUserMove) continue;

                // Get evaluation before and after the move
                // Evaluations are from white's perspective
                const evalBefore = evaluations[i];
                const evalAfter = evaluations[i + 1];

                // Calculate loss from user's perspective
                // If user is white: loss = evalBefore - evalAfter (positive if position got worse)
                // If user is black: loss = evalAfter - evalBefore (evals are from white's POV)
                let loss;
                if (isUserWhite) {
                    loss = evalBefore - evalAfter;
                } else {
                    loss = evalAfter - evalBefore;
                }

                // Only count positive loss (moves that made position worse)
                if (loss > 0) {
                    totalLoss += loss;
                }
                userMoves++;
            }

            if (userMoves === 0) return null;

            // Convert average centipawn loss to accuracy percentage
            // Using Chess.com's approximate formula: accuracy ≈ 103.1668 * e^(-0.04354 * ACPL) - 3.1669
            // ACPL = Average Centipawn Loss
            const avgLoss = totalLoss / userMoves;
            const accuracy = Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * avgLoss) - 3.1669));

            return Math.round(accuracy * 10) / 10;
        } catch (err) {
            console.error('Stockfish analysis error:', err);
            return null;
        }
    }

    function renderWeeklyTable() {
        if (!weeklyTableBodyEl) return;

        const playerEntries = Array.from(players.values());

        if (!playerEntries.length) {
            weeklyTableBodyEl.innerHTML = '';
            weeklyStatusEl.textContent = 'Add players to see their best and worst games from the last 7 days.';
            weeklyStatusEl.setAttribute('data-tone', 'info');
            return;
        }

        let hasAnyGames = false;

        weeklyTableBodyEl.innerHTML = '';

        for (const player of playerEntries) {
            const cached = gamesStore.get(player.username);
            const games = cached?.games || [];
            const { best, worst } = findBestWorstGames(games);

            if (games.length > 0) hasAnyGames = true;

            const row = document.createElement('tr');

            // Player cell
            const playerCell = document.createElement('td');
            const playerCellContent = document.createElement('div');
            playerCellContent.className = 'player-cell';

            const dot = document.createElement('div');
            dot.className = 'dot';
            dot.style.background = player.color;
            playerCellContent.appendChild(dot);

            const nameSpan = document.createElement('span');
            nameSpan.textContent = player.displayName;
            playerCellContent.appendChild(nameSpan);

            playerCell.appendChild(playerCellContent);
            row.appendChild(playerCell);

            // Best game cell
            const bestCell = document.createElement('td');
            if (best) {
                bestCell.appendChild(createGameCell(best, 'best'));
            } else if (games.length === 0) {
                bestCell.innerHTML = '<span class="no-games-cell">No games this week</span>';
            } else {
                bestCell.innerHTML = '<span class="no-games-cell">No accuracy data</span>';
            }
            row.appendChild(bestCell);

            // Worst game cell
            const worstCell = document.createElement('td');
            if (worst) {
                worstCell.appendChild(createGameCell(worst, 'worst'));
            } else if (games.length === 0) {
                worstCell.innerHTML = '<span class="no-games-cell">No games this week</span>';
            } else if (best && games.filter(g => g.accuracy != null).length <= 1) {
                worstCell.innerHTML = '<span class="no-games-cell">Only one game with data</span>';
            } else {
                worstCell.innerHTML = '<span class="no-games-cell">No accuracy data</span>';
            }
            row.appendChild(worstCell);

            weeklyTableBodyEl.appendChild(row);
        }

        // Update status and progress bar
        if (!hasAnyGames) {
            weeklyStatusEl.textContent = 'No games found in the last 7 days for tracked players.';
            weeklyStatusEl.setAttribute('data-tone', 'warn');
            analysisProgressEl?.classList.add('hidden');
        } else if (analysisQueue.length > 0 || isAnalyzing) {
            const remaining = analysisQueue.length + (isAnalyzing ? 1 : 0);
            weeklyStatusEl.textContent = 'Analyzing games with Stockfish... (' + remaining + ' remaining)';
            weeklyStatusEl.setAttribute('data-tone', 'info');

            // Update progress bar
            if (analysisProgressEl && analysisProgressBarEl && totalGamesToAnalyze > 0) {
                analysisProgressEl.classList.remove('hidden');
                const progress = (gamesAnalyzed / totalGamesToAnalyze) * 100;
                analysisProgressBarEl.style.width = progress + '%';
            }
        } else {
            weeklyStatusEl.textContent = 'Showing best and worst games from the last 7 days.';
            weeklyStatusEl.setAttribute('data-tone', 'success');
            analysisProgressEl?.classList.add('hidden');
        }
    }

    function createGameCell(game, type) {
        const cell = document.createElement('div');
        cell.className = 'game-cell ' + type;
        cell.addEventListener('click', () => openGameModal(game));

        const content = document.createElement('div');
        content.className = 'game-cell-content';

        // Accuracy badge
        const badge = document.createElement('span');
        badge.className = 'game-accuracy-badge';
        if (game.accuracy != null) {
            badge.textContent = game.accuracy.toFixed(1) + '%';
            if (game.accuracy >= 90) badge.classList.add('high');
            else if (game.accuracy >= 70) badge.classList.add('medium');
            else badge.classList.add('low');
        } else if (game.analysisStatus === 'analyzing') {
            badge.textContent = 'Analyzing...';
            badge.classList.add('analyzing');
        } else if (game.analysisStatus === 'failed') {
            badge.textContent = 'Failed';
            badge.classList.add('failed');
        } else {
            badge.textContent = 'Pending...';
            badge.classList.add('pending');
        }
        content.appendChild(badge);

        // Result
        const resultSpan = document.createElement('span');
        resultSpan.className = 'game-result ' + game.result;
        resultSpan.textContent = game.result.charAt(0).toUpperCase() + game.result.slice(1);
        content.appendChild(resultSpan);

        // Opponent
        const opponent = document.createElement('span');
        opponent.className = 'game-opponent';
        opponent.textContent = 'vs ' + game.opponentUsername + ' (' + game.opponentRating + ')';
        content.appendChild(opponent);

        cell.appendChild(content);
        return cell;
    }

    function openGameModal(game) {
        if (!modalOverlayEl || !game.pgn) return;

        currentGameData = game;
        modalOverlayEl.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        // Set game info - get player display name
        const player = players.get(game.username);
        const playerName = player?.displayName || game.username;
        modalPlayersEl.textContent = game.userColor === 'white'
            ? playerName + ' vs ' + game.opponentUsername
            : game.opponentUsername + ' vs ' + playerName;

        modalResultEl.textContent = game.result.charAt(0).toUpperCase() + game.result.slice(1);
        modalResultEl.className = 'game-result ' + game.result;

        if (game.accuracy != null) {
            modalAccuracyEl.textContent = 'Accuracy: ' + game.accuracy.toFixed(1) + '%';
        } else {
            modalAccuracyEl.textContent = 'Accuracy: N/A';
        }

        viewOnChesscomEl.href = game.url;

        // Initialize chessboard
        loadPgnIntoBoard(game.pgn, game.userColor);
    }

    function closeGameModal() {
        if (!modalOverlayEl) return;

        stopPlayback();
        modalOverlayEl.classList.add('hidden');
        document.body.style.overflow = '';
        currentGameData = null;

        if (chessBoard) {
            chessBoard.destroy();
            chessBoard = null;
        }
    }

    function loadPgnIntoBoard(pgn, userColor) {
        chessGame = new Chess();
        gameMoves = [];
        gameHistory = [];
        currentMoveIndex = 0;

        // Parse PGN
        const pgnLines = pgn.split('\n');
        let moveText = '';
        for (const line of pgnLines) {
            if (!line.startsWith('[')) {
                moveText += ' ' + line;
            }
        }

        // Extract moves
        const moveRegex = /(\d+\.+\s*)?([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?|O-O-O|O-O)([+#])?/g;
        let match;
        while ((match = moveRegex.exec(moveText)) !== null) {
            gameMoves.push(match[2]);
        }

        // Build history
        const tempChess = new Chess();
        gameHistory.push(tempChess.fen());
        for (const move of gameMoves) {
            try {
                tempChess.move(move);
                gameHistory.push(tempChess.fen());
            } catch (e) {
                break;
            }
        }

        // Initialize board
        const boardEl = document.getElementById('chess-board');
        if (chessBoard) {
            chessBoard.destroy();
        }

        chessBoard = Chessboard(boardEl, {
            position: 'start',
            orientation: userColor,
            pieceTheme: function(piece) {
                // Use Chess.com pieces CDN (piece format: wK, bQ, etc -> wk.png, bq.png)
                return 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/' + piece.toLowerCase() + '.png';
            }
        });

        // Render move list
        renderMoveList();
        updateMoveCounter();
    }

    function renderMoveList() {
        if (!moveListEl) return;

        moveListEl.innerHTML = '';
        for (let i = 0; i < gameMoves.length; i++) {
            if (i % 2 === 0) {
                const moveNum = document.createElement('span');
                moveNum.textContent = Math.floor(i / 2 + 1) + '. ';
                moveListEl.appendChild(moveNum);
            }

            const moveSpan = document.createElement('span');
            moveSpan.className = 'move';
            moveSpan.textContent = gameMoves[i];
            moveSpan.dataset.index = i + 1;
            moveSpan.addEventListener('click', () => goToMove(i + 1));
            moveListEl.appendChild(moveSpan);
            moveListEl.appendChild(document.createTextNode(' '));
        }
    }

    function goToMove(index) {
        if (!chessBoard || !gameHistory.length) return;

        index = Math.max(0, Math.min(index, gameHistory.length - 1));
        currentMoveIndex = index;

        chessBoard.position(gameHistory[index], false);
        updateMoveCounter();
        highlightCurrentMove();
    }

    function updateMoveCounter() {
        if (!moveCounterEl) return;
        moveCounterEl.textContent = 'Move ' + currentMoveIndex + ' / ' + gameMoves.length;
    }

    function highlightCurrentMove() {
        if (!moveListEl) return;

        moveListEl.querySelectorAll('.move').forEach(el => {
            el.classList.toggle('active', parseInt(el.dataset.index) === currentMoveIndex);
        });

        // Scroll active move into view
        const activeMove = moveListEl.querySelector('.move.active');
        if (activeMove) {
            activeMove.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    function togglePlayback() {
        if (playbackInterval) {
            stopPlayback();
        } else {
            startPlayback();
        }
    }

    function startPlayback() {
        if (currentMoveIndex >= gameMoves.length) {
            goToMove(0);
        }

        const playBtn = document.getElementById('btn-play');
        if (playBtn) playBtn.innerHTML = '&#10074;&#10074;'; // Pause icon

        playbackInterval = setInterval(() => {
            if (currentMoveIndex >= gameMoves.length) {
                stopPlayback();
                return;
            }
            goToMove(currentMoveIndex + 1);
        }, 1000);
    }

    function stopPlayback() {
        if (playbackInterval) {
            clearInterval(playbackInterval);
            playbackInterval = null;
        }

        const playBtn = document.getElementById('btn-play');
        if (playBtn) playBtn.innerHTML = '&#9658;'; // Play icon
    }

    // Hook into existing player updates
    const originalAddPlayer = addPlayer;
    addPlayer = async function(rawName, options = {}) {
        await originalAddPlayer.call(this, rawName, options);
        // Update weekly games after player is added
        setTimeout(() => updateWeeklyGames(), 100);
    };

    const originalRefreshAllPlayers = refreshAllPlayers;
    refreshAllPlayers = async function(options = {}) {
        await originalRefreshAllPlayers.call(this, options);
        // Clear games cache and update
        gamesStore.clear();
        setTimeout(() => updateWeeklyGames(), 100);
    };

    // Handle player removal - update weekly table
    const originalRenderList = renderList;
    renderList = function() {
        originalRenderList.call(this);
        // Clean up games for removed players
        for (const username of gamesStore.keys()) {
            if (!players.has(username)) {
                gamesStore.delete(username);
            }
        }
        renderWeeklyTable();
    };
})();
