(function () {
    const MONTHS_TO_FETCH = 6;
    const palette = ['#D19A66', '#C5865B', '#98C379', '#E5C07B', '#E06C75', '#B8B2A7', '#8C8577', '#E6E1DC'];
    const storageKey = 'elo-tracker:v1';
    const players = new Map();
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
            if (windowDays === null) {
                btn.classList.toggle('active', btn.dataset.window === 'max');
            } else {
                const val = parseInt(btn.dataset.window, 10);
                btn.classList.toggle('active', val === windowDays);
            }
        });
    }

    function formatWindowLabel(days) {
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
        renderList();
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
            renderList();
            updateChart();
            persistState();
            if (!options.silent) setStatus('Added ' + display + ' (' + points.length + ' points).', 'success');
        } catch (err) {
            console.error(err);
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
        if (!players.size) {
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
        playerCountEl.textContent = players.size;
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
        const endBound = domain.max;
        let startBound;

        if (windowDays === null) {
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
})();
