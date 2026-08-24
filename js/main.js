const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (!currentUser || currentUser.role !== 'lecturer') {
    alert("Please log in to continue.");
    window.location.href = 'login.html';
}

let roomList = [];
let roomImages = {};
let globalBookings = []; 
let globalTimetable = []; 
let compactScheduleDate = "";
let compactScheduleEventMap = {};

const timeSlots = [
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30",
    "20:00", "20:30", "21:00"
];
const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseStatus(rawStatus) {
    if (!rawStatus) return { status: "Pending", reason: "" };
    if (rawStatus.includes("ไม่อนุมัติ") || rawStatus.includes("Rejected") || rawStatus.includes("Declined")) {
        let reason = "";
        if (rawStatus.includes(":")) reason = rawStatus.split(":").slice(1).join(":").trim();
        return { status: "Declined", reason: reason };
    }
    if (rawStatus.includes("อนุมัติแล้ว") || rawStatus.includes("Approved")) return { status: "Approved", reason: "" };
    return { status: "Pending", reason: "" };
}

function getStatusTheme(status) {
    if (status === "Approved") {
        return {
            label: "Approved",
            badgeClass: "border-gray-300 border-l-emerald-700 bg-slate-50 text-slate-700",
            dotClass: "bg-emerald-700",
            panelClass: "border-l-emerald-700"
        };
    }

    if (status === "Declined") {
        return {
            label: "Declined",
            badgeClass: "border-gray-300 border-l-rose-800 bg-slate-50 text-slate-700",
            dotClass: "bg-rose-800",
            panelClass: "border-l-rose-800"
        };
    }

    return {
        label: "Pending",
        badgeClass: "border-gray-300 border-l-amber-700 bg-slate-50 text-slate-700",
        dotClass: "bg-amber-700",
        panelClass: "border-l-amber-700"
    };
}

function renderStatusBadge(status) {
    const theme = getStatusTheme(status);

    return `
        <span class="inline-flex items-center gap-2 rounded-sm border border-l-4 px-2.5 py-1 text-[11px] font-semibold ${theme.badgeClass}">
            <span class="h-1.5 w-1.5 rounded-full ${theme.dotClass}" aria-hidden="true"></span>
            <span>${theme.label}</span>
        </span>
    `;
}


function getUserIdSafe(bookingRecord) {
    for (let key in bookingRecord) {
        if (key.trim() === 'ID' || key.trim() === 'StudentID') return String(bookingRecord[key]).trim();
    }
    return "";
}

function checkNotifications(myBookings) {
    const savedStr = localStorage.getItem('bookingStatuses');
    const saved = savedStr ? JSON.parse(savedStr) : {};
    const notifications = [];

    myBookings.forEach(booking => {
        if (!booking.ID_RESERVE) return;

        const previousStatus = saved[booking.ID_RESERVE];
        const currentParsed = parseStatus(booking.Status);

        if (previousStatus === undefined) {
            saved[booking.ID_RESERVE] = booking.Status;
            return;
        }

        if (previousStatus !== booking.Status) {
            if (currentParsed.status !== "Pending") {
                notifications.push(booking);
            }
            saved[booking.ID_RESERVE] = booking.Status;
        }
    });

    localStorage.setItem('bookingStatuses', JSON.stringify(saved));

    if (notifications.length === 0) return;

    const existing = document.getElementById('notif-modal');
    if (existing) existing.remove();

    const itemsHTML = notifications.map(booking => {
        const parsed = parseStatus(booking.Status);
        const theme = getStatusTheme(parsed.status);

        const reasonHTML = parsed.reason
            ? `
                <div class="mt-3 border-l-2 border-rose-800 pl-3">
                    <p class="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Reason</p>
                    <p class="mt-1 text-xs leading-relaxed text-gray-700">${parsed.reason}</p>
                </div>
            `
            : '';

        return `
            <section class="rounded-sm border border-gray-300 border-l-4 bg-white p-4 ${theme.panelClass}">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div class="min-w-0">
                        <p class="text-sm font-semibold text-gray-900">${booking.Room}</p>
                        <p class="mt-1 text-xs text-gray-500">${booking.Date} · ${booking.TimeRange || ''}</p>
                    </div>
                    <div class="shrink-0">
                        ${renderStatusBadge(parsed.status)}
                    </div>
                </div>
                ${reasonHTML}
            </section>
        `;
    }).join('');

    const html = `
        <div
            id="notif-modal"
            class="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/55 px-4 py-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notif-modal-title"
            onclick="if (event.target === this) closeNotificationModal()">

            <div class="w-full max-w-md overflow-hidden rounded-md border border-gray-300 bg-white shadow-xl">
                <div class="flex items-start justify-between gap-4 border-b border-gray-300 px-5 py-4">
                    <div>
                        <p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                            Reservation notice
                        </p>
                        <h3 id="notif-modal-title" class="mt-1 text-lg font-semibold text-gray-900">
                            Reservation status updated
                        </h3>
                        <p class="mt-1 text-xs leading-relaxed text-gray-500">
                            A reservation request has been reviewed by the administrator.
                        </p>
                    </div>

                    <button
                        type="button"
                        onclick="closeNotificationModal()"
                        class="grid h-8 w-8 shrink-0 place-items-center rounded-sm border border-gray-300 bg-white text-lg leading-none text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                        aria-label="Close notification">
                        &times;
                    </button>
                </div>

                <div class="max-h-[55vh] space-y-3 overflow-y-auto px-5 py-4 custom-scrollbar">
                    ${itemsHTML}
                </div>

                <div class="flex justify-end border-t border-gray-300 bg-gray-50 px-5 py-3">
                    <button
                        type="button"
                        onclick="closeNotificationModal()"
                        class="rounded-sm border border-slate-800 bg-slate-800 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-900">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    document.body.style.overflow = 'hidden';
}

window.closeNotificationModal = function() {
    const modal = document.getElementById('notif-modal');
    if (modal) modal.remove();
    document.body.style.overflow = '';
};


function populateTimeDropdowns(startId, endId) {
    const stSelect = document.getElementById(startId);
    const etSelect = document.getElementById(endId);
    if (!stSelect || !etSelect) return;
    
    stSelect.innerHTML = '<option value="">-- Start --</option>';
    etSelect.innerHTML = '<option value="">-- End --</option>';
    
    const endSlots = [...timeSlots, "21:30"];
    
    timeSlots.forEach(t => stSelect.innerHTML += `<option value="${t}">${t}</option>`);
    endSlots.forEach(t => {
        if(t !== "08:00") etSelect.innerHTML += `<option value="${t}">${t}</option>`;
    });
}


function compactEscapeHtml(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function compactLocalToday() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function compactDateFromParts(dateString) {
    const parts = String(dateString || "").split("-").map(Number);
    if (parts.length !== 3 || parts.some(value => !Number.isFinite(value))) {
        return null;
    }
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

function compactDateToYmd(date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");
}

function compactShiftDateValue(dateString, amount) {
    const date = compactDateFromParts(dateString);
    if (!date) return compactLocalToday();
    date.setDate(date.getDate() + amount);
    return compactDateToYmd(date);
}

function compactFormatDate(dateString) {
    const date = compactDateFromParts(dateString);
    if (!date) return dateString || "";
    return date.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

function compactNormalizeDate(value) {
    const raw = String(value == null ? "" : value).trim();
    if (!raw) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slash) {
        return [
            slash[3],
            String(slash[2]).padStart(2, "0"),
            String(slash[1]).padStart(2, "0")
        ].join("-");
    }
    return raw;
}

function compactTimeToMinutes(value) {
    const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
}

function compactParseRange(value) {
    const parts = String(value || "").split(/\s*-\s*/);
    if (parts.length !== 2) return null;

    const start = compactTimeToMinutes(parts[0]);
    const end = compactTimeToMinutes(parts[1]);

    if (start == null || end == null || end <= start) return null;
    return {
        start,
        end,
        startLabel: parts[0].trim(),
        endLabel: parts[1].trim()
    };
}

function compactTimetableMatchesDate(item, room, selectedDate) {
    if (String(item.Room || "").trim() !== String(room || "").trim()) return false;

    const date = compactDateFromParts(selectedDate);
    if (!date) return false;

    const dayName = daysOfWeek[date.getDay()].toLowerCase();
    if (String(item.DayOfWeek || "").trim().toLowerCase() !== dayName) return false;

    const startDate = compactNormalizeDate(item.Start_Date);
    const endDate = compactNormalizeDate(item.End_Date);

    if (startDate && selectedDate < startDate) return false;
    if (endDate && selectedDate > endDate) return false;

    const exceptions = String(item.Exception_Dates || "")
        .split(",")
        .map(value => compactNormalizeDate(value))
        .filter(Boolean);

    return !exceptions.includes(selectedDate);
}

function compactBuildEvents(selectedDate) {
    const startBoundary = 8 * 60;
    const endBoundary = 21 * 60 + 30;
    const events = [];

    roomList.forEach(room => {
        globalTimetable.forEach(item => {
            if (!compactTimetableMatchesDate(item, room, selectedDate)) return;

            const range = compactParseRange(item.TimeRange);
            if (!range || range.end <= startBoundary || range.start >= endBoundary) return;

            events.push({
                kind: "class",
                room,
                start: Math.max(range.start, startBoundary),
                end: Math.min(range.end, endBoundary),
                startLabel: range.startLabel,
                endLabel: range.endLabel,
                title: item.Course_ID || item.Course || "Scheduled class",
                secondary: item.Course || "",
                person: item.Lecturer || ""
            });
        });

        globalBookings.forEach(booking => {
            const parsed = parseStatus(booking.Status);
            if (parsed.status !== "Approved") return;
            if (String(booking.Room || "").trim() !== String(room || "").trim()) return;
            if (compactNormalizeDate(booking.Date) !== selectedDate) return;

            const range = compactParseRange(booking.TimeRange);
            if (!range || range.end <= startBoundary || range.start >= endBoundary) return;

            events.push({
                kind: "booking",
                room,
                start: Math.max(range.start, startBoundary),
                end: Math.min(range.end, endBoundary),
                startLabel: range.startLabel,
                endLabel: range.endLabel,
                title: booking.Name || "Reservation",
                secondary: booking.Reason || "Room reservation",
                person: "Approved reservation"
            });
        });
    });

    return events.sort((a, b) => {
        if (a.room !== b.room) return a.room.localeCompare(b.room);
        return a.start - b.start;
    });
}

function compactPositionPopover() {
    const popover = document.getElementById("compact-schedule-popover");
    const button = document.getElementById("compact-schedule-trigger");
    if (!popover || !button || popover.hidden) return;

    if (window.innerWidth <= 640) {
        popover.style.left = "10px";
        popover.style.right = "10px";
        popover.style.top = "auto";
        popover.style.bottom = "10px";
        return;
    }

    popover.style.right = "auto";
    popover.style.bottom = "auto";

    const rect = button.getBoundingClientRect();
    const width = Math.min(520, window.innerWidth - 32);
    const left = Math.min(
        Math.max(16, rect.right - width),
        window.innerWidth - width - 16
    );

    popover.style.width = `${width}px`;
    popover.style.left = `${left}px`;
    popover.style.top = `${rect.bottom + 8}px`;

    requestAnimationFrame(() => {
        const popoverRect = popover.getBoundingClientRect();
        if (popoverRect.bottom > window.innerHeight - 16) {
            const top = Math.max(16, rect.top - popoverRect.height - 8);
            popover.style.top = `${top}px`;
        }
    });
}

function initializeCompactSchedule() {
    const dateInput = document.getElementById("view-date");
    if (!dateInput || document.getElementById("compact-schedule-trigger")) return;

    const dateControl = dateInput.parentElement;
    const toolbar = document.createElement("div");
    toolbar.className = "compact-schedule-toolbar";
    toolbar.id = "compact-schedule-toolbar";

    dateControl.parentNode.insertBefore(toolbar, dateControl);
    toolbar.appendChild(dateControl);

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.id = "compact-schedule-trigger";
    trigger.className = "compact-schedule-trigger";
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", "compact-schedule-popover");
    trigger.title = "Open compact timetable";
    trigger.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
            <rect x="3.5" y="4.5" width="17" height="15" rx="1.5"></rect>
            <path d="M3.5 9.5h17M9 4.5v15M14.5 4.5v15"></path>
        </svg>
        <span>Compact view</span>
    `;
    trigger.addEventListener("click", event => {
        event.stopPropagation();
        toggleCompactSchedule();
    });
    toolbar.appendChild(trigger);

    const popover = document.createElement("section");
    popover.id = "compact-schedule-popover";
    popover.className = "compact-schedule-popover";
    popover.hidden = true;
    popover.setAttribute("role", "dialog");
    popover.setAttribute("aria-modal", "false");
    popover.setAttribute("aria-label", "Compact timetable");
    popover.addEventListener("click", event => event.stopPropagation());
    document.body.appendChild(popover);

    document.addEventListener("click", closeCompactSchedule);
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") closeCompactSchedule();
    });
    window.addEventListener("resize", compactPositionPopover);
    window.addEventListener("scroll", compactPositionPopover, true);
}

function toggleCompactSchedule() {
    const popover = document.getElementById("compact-schedule-popover");
    const button = document.getElementById("compact-schedule-trigger");
    if (!popover || !button) return;

    if (!popover.hidden) {
        closeCompactSchedule();
        return;
    }

    compactScheduleDate =
        document.getElementById("view-date")?.value ||
        compactScheduleDate ||
        compactLocalToday();

    popover.hidden = false;
    button.setAttribute("aria-expanded", "true");
    renderCompactSchedule();
    compactPositionPopover();
}

function closeCompactSchedule() {
    const popover = document.getElementById("compact-schedule-popover");
    const button = document.getElementById("compact-schedule-trigger");
    if (popover) popover.hidden = true;
    if (button) button.setAttribute("aria-expanded", "false");
}

function shiftCompactScheduleDate(amount) {
    compactScheduleDate = compactShiftDateValue(
        compactScheduleDate || compactLocalToday(),
        amount
    );
    renderCompactSchedule();
}

function setCompactScheduleToday() {
    compactScheduleDate = compactLocalToday();
    renderCompactSchedule();
}

function handleCompactScheduleDateChange(value) {
    if (!value) return;
    compactScheduleDate = value;
    renderCompactSchedule();
}

function openCompactDateInFullView() {
    const dateInput = document.getElementById("view-date");
    if (!dateInput || !compactScheduleDate) return;

    dateInput.value = compactScheduleDate;
    closeCompactSchedule();
    loadSchedule(true);
}

function showCompactScheduleDetail(eventId) {
    const eventData = compactScheduleEventMap[eventId];
    const detail = document.getElementById("compact-schedule-detail");
    if (!eventData || !detail) return;

    const kindLabel = eventData.kind === "class"
        ? "Scheduled class"
        : "Approved reservation";

    const secondary = eventData.secondary
        ? `<div>${compactEscapeHtml(eventData.secondary)}</div>`
        : "";

    const person = eventData.person
        ? `<div>${compactEscapeHtml(eventData.person)}</div>`
        : "";

    detail.innerHTML = `
        <p class="compact-schedule-detail-title">${compactEscapeHtml(eventData.title)}</p>
        <div>${compactEscapeHtml(kindLabel)} · ${compactEscapeHtml(eventData.room)}</div>
        <div>${compactEscapeHtml(eventData.startLabel)}–${compactEscapeHtml(eventData.endLabel)}</div>
        ${secondary}
        ${person}
    `;
    detail.hidden = false;
}

function renderCompactSchedule() {
    const popover = document.getElementById("compact-schedule-popover");
    if (!popover || popover.hidden) return;

    const selectedDate = compactScheduleDate || compactLocalToday();
    const allEvents = compactBuildEvents(selectedDate);
    compactScheduleEventMap = {};

    const startBoundary = 8 * 60;
    const endBoundary = 21 * 60 + 30;
    const totalMinutes = endBoundary - startBoundary;
    const hourLabels = [
        { label: "08", minute: 8 * 60 },
        { label: "10", minute: 10 * 60 },
        { label: "12", minute: 12 * 60 },
        { label: "14", minute: 14 * 60 },
        { label: "16", minute: 16 * 60 },
        { label: "18", minute: 18 * 60 },
        { label: "20", minute: 20 * 60 },
        { label: "21:30", minute: 21 * 60 + 30 }
    ];

    const labelsHTML = hourLabels.map(item => {
        const left = ((item.minute - startBoundary) / totalMinutes) * 100;
        const clampedLeft = Math.max(0, Math.min(100, left));
        return `
            <span class="compact-schedule-time-label" style="left:${clampedLeft}%">
                ${item.label}
            </span>
        `;
    }).join("");

    const rowsHTML = roomList.map((room, roomIndex) => {
        const roomEvents = allEvents.filter(eventData => eventData.room === room);

        const eventHTML = roomEvents.map((eventData, eventIndex) => {
            const id = `compact-event-${roomIndex}-${eventIndex}`;
            compactScheduleEventMap[id] = eventData;

            const left = ((eventData.start - startBoundary) / totalMinutes) * 100;
            const width = ((eventData.end - eventData.start) / totalMinutes) * 100;
            const kindClass = eventData.kind === "class"
                ? "compact-schedule-event--class"
                : "compact-schedule-event--booking";

            const tooltip = [
                eventData.title,
                eventData.secondary,
                eventData.startLabel + "–" + eventData.endLabel
            ].filter(Boolean).join(" · ");

            return `
                <button
                    type="button"
                    class="compact-schedule-event ${kindClass}"
                    style="left:${left}%;width:${Math.max(width, 0.8)}%"
                    title="${compactEscapeHtml(tooltip)}"
                    onclick="showCompactScheduleDetail('${id}')">
                    ${compactEscapeHtml(eventData.title)}
                </button>
            `;
        }).join("");

        return `
            <div class="compact-schedule-row">
                <div class="compact-schedule-room" title="${compactEscapeHtml(room)}">
                    <span>${compactEscapeHtml(room)}</span>
                </div>
                <div class="compact-schedule-track">${eventHTML}</div>
            </div>
        `;
    }).join("");

    const gridHTML = roomList.length
        ? `
            <div class="compact-schedule-grid">
                <div class="compact-schedule-row">
                    <div class="compact-schedule-room compact-schedule-time-room">
                        <span>Room</span>
                    </div>
                    <div class="compact-schedule-track compact-schedule-time-track">
                        ${labelsHTML}
                    </div>
                </div>
                ${rowsHTML}
            </div>
        `
        : `<div class="compact-schedule-empty">No room data is available.</div>`;

    popover.innerHTML = `
        <div class="compact-schedule-header">
            <div>
                <p class="compact-schedule-kicker">Quick room overview</p>
                <h3 class="compact-schedule-title">Compact timetable</h3>
                <p class="compact-schedule-date-label">${compactEscapeHtml(compactFormatDate(selectedDate))}</p>
            </div>
            <button
                type="button"
                class="compact-schedule-close"
                onclick="closeCompactSchedule()"
                aria-label="Close compact timetable">
                &times;
            </button>
        </div>

        <div class="compact-schedule-controls">
            <button type="button" class="compact-schedule-control-button" onclick="shiftCompactScheduleDate(-1)" aria-label="Previous day">‹</button>
            <input
                type="date"
                class="compact-schedule-date-input"
                value="${compactEscapeHtml(selectedDate)}"
                onchange="handleCompactScheduleDateChange(this.value)">
            <button type="button" class="compact-schedule-today-button" onclick="setCompactScheduleToday()">Today</button>
            <button type="button" class="compact-schedule-control-button" onclick="shiftCompactScheduleDate(1)" aria-label="Next day">›</button>
        </div>

        <div class="compact-schedule-content custom-scrollbar">
            ${gridHTML}
        </div>

        <div class="compact-schedule-legend">
            <span class="compact-schedule-legend-item">
                <span class="compact-schedule-legend-swatch compact-schedule-event--class"></span>
                Scheduled class
            </span>
            <span class="compact-schedule-legend-item">
                <span class="compact-schedule-legend-swatch compact-schedule-event--booking"></span>
                Approved reservation
            </span>
        </div>

        <div id="compact-schedule-detail" class="compact-schedule-detail" hidden></div>

        <div class="compact-schedule-footer">
            <button type="button" class="compact-schedule-open-full" onclick="openCompactDateInFullView()">
                Open in full timetable
            </button>
        </div>
    `;

    compactPositionPopover();
}


window.onload = function() {
    const style = document.createElement('style');
    style.innerHTML = `
        body { overflow-x: hidden; }
        .fix-overflow { min-width: 0 !important; max-width: 100% !important; width: 100% !important; }
        .scroll-wrapper { display: block; width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .sticky-col { position: sticky; left: 0; z-index: 30; background-color: #f9fafb; }
        .sticky-col-white { position: sticky; left: 0; z-index: 20; background-color: #ffffff; }
        .sticky-col::after, .sticky-col-white::after { content: ''; position: absolute; top: 0; right: 0; bottom: 0; width: 5px; box-shadow: inset -4px 0 6px -3px rgba(0,0,0,0.1); pointer-events: none; }
        .schedule-cell {
            padding: 6px;
            vertical-align: top;
            background: #ffffff;
            border-bottom: 1px solid #e5e7eb;
            border-left: 1px solid #e5e7eb;
        }
        .schedule-event {
            min-height: 58px;
            height: 100%;
            padding: 9px 10px 8px 11px;
            border: 1px solid #d9dee8;
            border-left-width: 3px;
            border-radius: 4px;
            background: #f8fafc;
            box-shadow: none;
            overflow: hidden;
        }
        .schedule-event--class {
            border-left-color: #9a6b1f;
            background: #fbfaf6;
        }
        .schedule-event--booking {
            border-left-color: #2f477f;
            background: #f4f6fb;
        }
        .schedule-event__title {
            margin: 0;
            color: #1f2937;
            font-size: 12px;
            font-weight: 700;
            line-height: 1.35;
        }
        .schedule-event__meta {
            margin-top: 3px;
            color: #5f6b7a;
            font-size: 10px;
            font-weight: 500;
            line-height: 1.35;
        }
        .schedule-event__detail {
            margin-top: 5px;
            color: #475467;
            font-size: 10px;
            font-weight: 400;
            line-height: 1.4;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
        }

        .compact-schedule-toolbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
        }
        .compact-schedule-trigger {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            min-height: 38px;
            padding: 8px 11px;
            border: 1px solid #cfd5df;
            border-radius: 5px;
            color: #344054;
            background: #ffffff;
            font-size: 11px;
            font-weight: 600;
            line-height: 1;
            cursor: pointer;
            transition: border-color 140ms ease, background-color 140ms ease, color 140ms ease;
        }
        .compact-schedule-trigger:hover,
        .compact-schedule-trigger[aria-expanded="true"] {
            border-color: #23376f;
            color: #172554;
            background: #f7f8fc;
        }
        .compact-schedule-trigger svg {
            width: 17px;
            height: 17px;
        }
        .compact-schedule-popover {
            position: fixed;
            z-index: 9998;
            width: min(520px, calc(100vw - 32px));
            max-height: min(620px, calc(100vh - 32px));
            overflow: hidden;
            border: 1px solid #cfd5df;
            border-radius: 7px;
            background: #ffffff;
            box-shadow: 0 16px 42px rgba(15, 23, 42, 0.18);
        }
        .compact-schedule-popover[hidden] {
            display: none !important;
        }
        .compact-schedule-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
            padding: 14px 16px 12px;
            border-bottom: 1px solid #e5e7eb;
        }
        .compact-schedule-kicker {
            margin: 0;
            color: #667085;
            font-size: 9px;
            font-weight: 700;
            letter-spacing: 0.12em;
            text-transform: uppercase;
        }
        .compact-schedule-title {
            margin: 3px 0 0;
            color: #1f2937;
            font-size: 15px;
            font-weight: 700;
            line-height: 1.35;
        }
        .compact-schedule-date-label {
            margin: 3px 0 0;
            color: #667085;
            font-size: 10px;
            line-height: 1.45;
        }
        .compact-schedule-close {
            display: grid;
            width: 30px;
            height: 30px;
            flex: 0 0 auto;
            place-items: center;
            border: 1px solid #d0d5dd;
            border-radius: 4px;
            color: #667085;
            background: #ffffff;
            font-size: 18px;
            line-height: 1;
            cursor: pointer;
        }
        .compact-schedule-close:hover {
            color: #1f2937;
            background: #f9fafb;
        }
        .compact-schedule-controls {
            display: grid;
            grid-template-columns: 34px minmax(150px, 1fr) auto 34px;
            gap: 7px;
            padding: 11px 16px;
            border-bottom: 1px solid #eaecf0;
            background: #f9fafb;
        }
        .compact-schedule-control-button,
        .compact-schedule-today-button {
            min-height: 34px;
            border: 1px solid #d0d5dd;
            border-radius: 4px;
            color: #344054;
            background: #ffffff;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
        }
        .compact-schedule-control-button:hover,
        .compact-schedule-today-button:hover {
            border-color: #98a2b3;
            background: #f9fafb;
        }
        .compact-schedule-date-input {
            width: 100%;
            min-height: 34px;
            border: 1px solid #d0d5dd;
            border-radius: 4px;
            padding: 5px 8px;
            color: #344054;
            background: #ffffff;
            font-size: 11px;
            outline: none;
        }
        .compact-schedule-date-input:focus {
            border-color: #475d9d;
            box-shadow: 0 0 0 2px rgba(71, 93, 157, 0.10);
        }
        .compact-schedule-content {
            max-height: 390px;
            overflow: auto;
            overscroll-behavior: contain;
        }
        .compact-schedule-grid {
            min-width: 438px;
            border-bottom: 1px solid #e5e7eb;
        }
        .compact-schedule-row {
            display: grid;
            grid-template-columns: 104px minmax(334px, 1fr);
            min-height: 35px;
            border-top: 1px solid #eef0f3;
        }
        .compact-schedule-row:first-child {
            border-top: 0;
        }
        .compact-schedule-room {
            display: flex;
            align-items: center;
            min-width: 0;
            padding: 7px 9px;
            border-right: 1px solid #e5e7eb;
            color: #344054;
            background: #ffffff;
            font-size: 10px;
            font-weight: 650;
            line-height: 1.3;
        }
        .compact-schedule-room span {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .compact-schedule-time-room {
            color: #667085;
            background: #f9fafb;
            font-size: 9px;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
        }
        .compact-schedule-track {
            position: relative;
            min-width: 334px;
            min-height: 35px;
            background:
                repeating-linear-gradient(
                    to right,
                    transparent 0,
                    transparent calc(3.7037037% - 1px),
                    #edf0f3 calc(3.7037037% - 1px),
                    #edf0f3 3.7037037%
                ),
                #ffffff;
        }
        .compact-schedule-time-track {
            min-height: 35px;
            background:
                repeating-linear-gradient(
                    to right,
                    transparent 0,
                    transparent calc(3.7037037% - 1px),
                    #e4e7ec calc(3.7037037% - 1px),
                    #e4e7ec 3.7037037%
                ),
                #f9fafb;
        }
        .compact-schedule-time-label {
            position: absolute;
            top: 50%;
            color: #667085;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 8px;
            font-weight: 700;
            transform: translate(-50%, -50%);
            white-space: nowrap;
        }
        .compact-schedule-event {
            position: absolute;
            top: 7px;
            height: 21px;
            min-width: 4px;
            overflow: hidden;
            border: 1px solid transparent;
            border-left-width: 3px;
            border-radius: 3px;
            padding: 2px 5px;
            text-align: left;
            font-size: 8px;
            font-weight: 700;
            line-height: 15px;
            white-space: nowrap;
            text-overflow: ellipsis;
            cursor: pointer;
        }
        .compact-schedule-event--class {
            border-color: #d9c49a;
            border-left-color: #b7791f;
            color: #694b16;
            background: #fbf5e8;
        }
        .compact-schedule-event--booking {
            border-color: #b8c9ed;
            border-left-color: #3560ad;
            color: #244278;
            background: #edf3ff;
        }
        .compact-schedule-event:hover,
        .compact-schedule-event:focus-visible {
            filter: brightness(0.97);
            outline: 2px solid rgba(35, 55, 111, 0.14);
            outline-offset: 1px;
        }
        .compact-schedule-legend {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            padding: 9px 16px;
            border-top: 1px solid #eaecf0;
            color: #667085;
            background: #ffffff;
            font-size: 9px;
        }
        .compact-schedule-legend-item {
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        .compact-schedule-legend-swatch {
            width: 18px;
            height: 8px;
            border: 1px solid;
            border-left-width: 3px;
            border-radius: 2px;
        }
        .compact-schedule-detail {
            margin: 0 16px 12px;
            padding: 10px 11px;
            border: 1px solid #dfe3ea;
            border-left: 3px solid #475d9d;
            border-radius: 4px;
            color: #475467;
            background: #f8f9fb;
            font-size: 10px;
            line-height: 1.55;
        }
        .compact-schedule-detail[hidden] {
            display: none !important;
        }
        .compact-schedule-detail-title {
            margin: 0 0 3px;
            color: #1f2937;
            font-size: 11px;
            font-weight: 700;
        }
        .compact-schedule-footer {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 8px;
            padding: 10px 16px;
            border-top: 1px solid #e5e7eb;
            background: #f9fafb;
        }
        .compact-schedule-open-full {
            min-height: 34px;
            border: 1px solid #23376f;
            border-radius: 4px;
            padding: 7px 12px;
            color: #ffffff;
            background: #23376f;
            font-size: 10px;
            font-weight: 650;
            cursor: pointer;
        }
        .compact-schedule-open-full:hover {
            background: #172554;
        }
        .compact-schedule-empty {
            padding: 28px 16px;
            color: #667085;
            text-align: center;
            font-size: 11px;
        }
        @media (max-width: 640px) {
            .compact-schedule-popover {
                left: 10px !important;
                right: 10px !important;
                bottom: 10px !important;
                top: auto !important;
                width: auto;
                max-height: 72vh;
                border-radius: 8px;
            }
            .compact-schedule-content {
                max-height: 46vh;
            }
            .compact-schedule-controls {
                grid-template-columns: 34px minmax(130px, 1fr) 34px;
            }
            .compact-schedule-today-button {
                display: none;
            }
        }

    `;
    document.head.appendChild(style);

    const containers = ['content-timetable', 'content-my-booking', 'timetable-container', 'my-reservations-container'];
    containers.forEach(id => { const el = document.getElementById(id); if(el) el.classList.add('fix-overflow'); });

    document.getElementById('name').value = currentUser.name;
    document.getElementById('staffId').value = currentUser.id;
    document.getElementById('user-display').innerText = `Lecturer: ${currentUser.name}`;

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('view-date').value = today;
    
    const dateInput = document.getElementById('date');
    if (dateInput) {
        dateInput.value = today;
        dateInput.min = today; 
    }

    populateTimeDropdowns('startTime', 'endTime');
    initializeCompactSchedule();
    loadSchedule();
    setInterval(() => { loadSchedule(true); }, 60000);
};

function switchTab(tabName) {
    const tabTimetable = document.getElementById('tab-timetable');
    const tabMyBooking = document.getElementById('tab-my-booking');
    const contentTimetable = document.getElementById('content-timetable');
    const contentMyBooking = document.getElementById('content-my-booking');

    const activeClass = "py-2.5 px-6 font-bold text-sm border-b-2 border-indigo-600 text-indigo-700 focus:outline-none uppercase tracking-wider whitespace-nowrap transition-colors";
    const inactiveClass = "py-2.5 px-6 font-medium text-sm border-b-2 border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300 focus:outline-none uppercase tracking-wider whitespace-nowrap transition-colors";

    if (tabName === 'timetable') {
        tabTimetable.className = activeClass;
        tabMyBooking.className = inactiveClass;
        contentTimetable.classList.remove('hidden');
        contentMyBooking.classList.add('hidden');
    } else {
        tabMyBooking.className = activeClass;
        tabTimetable.className = inactiveClass;
        contentTimetable.classList.add('hidden');
        contentMyBooking.classList.remove('hidden');
        closeCompactSchedule();
    }
}

async function loadSchedule(isSilent = false) {
    const timetableContainer = document.getElementById('timetable-container');
    const myReservationsContainer = document.getElementById('my-reservations-container');
    const selectedDate = document.getElementById('view-date').value;

    if (!isSilent) {
        const loadingHTML = `
            <div class="py-16 flex flex-col justify-center items-center animate-in fade-in duration-500">
                <div class="relative flex justify-center items-center w-20 h-20 mb-6">
                    <div class="absolute inset-0 border-[1.5px] border-gray-300 rounded-full"></div>
                    <div class="absolute inset-0 border-[1.5px] border-t-indigo-800 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                    <img src="logo.png" alt="Logo" class="w-11 h-11 object-contain opacity-90">
                </div>
                <div class="text-center flex flex-col items-center">
                    <p class="text-gray-800 font-bold tracking-[0.2em] text-[10px] uppercase mb-2">Synchronizing</p>
                    <div class="flex space-x-1.5 mb-3">
                        <div class="w-1 h-1 bg-indigo-800 rounded-full animate-bounce" style="animation-delay: 0s;"></div>
                        <div class="w-1 h-1 bg-indigo-600 rounded-full animate-bounce" style="animation-delay: 0.15s;"></div>
                        <div class="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" style="animation-delay: 0.3s;"></div>
                    </div>
                    <p class="text-[10px] text-gray-400 font-medium tracking-wide">กำลังเตรียมข้อมูล...</p>
                </div>
            </div>
        `;
        timetableContainer.innerHTML = loadingHTML;
        myReservationsContainer.innerHTML = loadingHTML;
    } else {
        const rIcon = document.getElementById('refresh-icon');
        if (rIcon) rIcon.classList.add('animate-spin');
    }

    try {
        // 💡 ถ้าเป็นการ Refresh เงียบๆ (isSilent) ให้ขอแค่ข้อมูล Bookings ก็พอ
        const fetchUrl = isSilent ? `${API_URL}?type=bookings_only` : API_URL;
        const response = await fetch(fetchUrl);
        const result = await response.json();

        if (result.status === "success") {
            globalBookings = result.data || [];
            
            // 💡 อัปเดตรายชื่อห้องและตารางเรียน เฉพาะตอนโหลดครั้งแรกสุดเท่านั้น
            if (!isSilent) {
                globalTimetable = result.timetable || [];
                const fetchedRooms = result.rooms || [];
                roomList = [];
                roomImages = {};
                const roomSelect = document.getElementById('room');
                roomSelect.innerHTML = '<option value="">-- Select a Room --</option>'; 
                fetchedRooms.forEach(r => {
                    if (r.RoomName) {
                        roomList.push(r.RoomName);
                        roomImages[r.RoomName] = r.ImageURL;
                        roomSelect.innerHTML += `<option value="${r.RoomName}">${r.RoomName}</option>`;
                    }
                });
            }
    

            const currentDayName = daysOfWeek[new Date(selectedDate + 'T00:00:00').getDay()];

            let gridHTML = `<div class="scroll-wrapper border border-gray-300 rounded-lg bg-white custom-scrollbar pb-2 pr-6">
                <table class="w-max min-w-full text-left bg-white border-collapse">
                <thead class="bg-gray-50 text-gray-600 font-bold text-[11px] uppercase tracking-wider">
                    <tr><th class="px-5 py-4 border-b border-r border-gray-300 sticky-col min-w-[200px] max-w-[200px] z-30">Room / Time</th>`;
            
            timeSlots.forEach((slot, index) => { 
                    const alignClass = index === 0 ? "left-1.5 -translate-x-0" : "left-0 -translate-x-1/2";
                    gridHTML += `<th class="border-b border-l border-gray-300 bg-gray-50 min-w-[100px] h-12 relative">
                    <div class="absolute ${alignClass} bottom-2 font-mono text-[11px] font-bold text-gray-600 bg-gray-50 px-1 z-0">${slot}</div>`;
                if(index === timeSlots.length - 1) {
                    gridHTML += `<div class="absolute right-0 bottom-2 translate-x-1/2 font-mono text-[11px] font-bold text-gray-500 bg-gray-50 px-1 z-0">21:30</div>`;
                }
                gridHTML += `</th>`; 
            });
            gridHTML += `</tr></thead><tbody class="divide-y divide-gray-100">`;

            roomList.forEach(room => {
                gridHTML += `<tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-5 py-4 font-bold text-gray-800 border-b border-r border-gray-300 sticky-col-white min-w-[200px] max-w-[200px] truncate z-20" title="${room}">${room}</td>`;
                
                for (let i = 0; i < timeSlots.length; i++) {
                    const slot = timeSlots[i];

                    const isRegularClass = globalTimetable.find(t => {
                        if (t.Room !== room || t.DayOfWeek.trim().toLowerCase() !== currentDayName.toLowerCase()) return false;
                        
                        // ✅ เพิ่มลอจิกเช็กภาคการศึกษา ให้หน้าอาจารย์
                        if (t.Start_Date && t.End_Date) {
                            const checkDate = new Date(selectedDate);
                            const startDate = new Date(t.Start_Date.trim());
                            const endDate = new Date(t.End_Date.trim());
                            checkDate.setHours(0,0,0,0); startDate.setHours(0,0,0,0); endDate.setHours(0,0,0,0);
                            if (checkDate < startDate || checkDate > endDate) return false;
                        }

                        if (t.Exception_Dates && t.Exception_Dates.includes(selectedDate)) return false; 
                        const [start, end] = t.TimeRange.split(" - ");
                        return slot >= start.trim() && slot < end.trim();
                    });

                    const isBooked = globalBookings.find(b => {
                        const parsed = parseStatus(b.Status);
                        if (b.Room !== room || b.Date !== selectedDate || parsed.status !== "Approved") return false;
                        const [start, end] = b.TimeRange.split(" - ");
                        return slot >= start.trim() && slot < end.trim();
                    });

                    if (isRegularClass) {
                        let span = 1;
                        while (i + span < timeSlots.length) {
                            const nextSlot = timeSlots[i + span];
                            const [s, e] = isRegularClass.TimeRange.split(" - ");
                            if (nextSlot >= s.trim() && nextSlot < e.trim()) span++; else break;
                        }
                        gridHTML += `<td colspan="${span}" class="schedule-cell min-w-[${span * 100}px]">
                            <div class="schedule-event schedule-event--class" title="${isRegularClass.Course || ''}">
                                <div class="schedule-event__title">${isRegularClass.Course_ID || 'Scheduled Class'}</div>
                                <div class="schedule-event__meta">${isRegularClass.Lecturer || ''}</div>
                                <div class="schedule-event__detail">${isRegularClass.Course || ''}</div>
                            </div>
                        </td>`;
                        i += (span - 1);
                    } else if (isBooked) {
                        let span = 1;
                        while (i + span < timeSlots.length) {
                            const nextSlot = timeSlots[i + span];
                            const [s, e] = isBooked.TimeRange.split(" - ");
                            if (nextSlot >= s.trim() && nextSlot < e.trim()) span++; else break;
                        }
                        gridHTML += `<td colspan="${span}" class="schedule-cell min-w-[${span * 100}px]">
                            <div class="schedule-event schedule-event--booking" title="${isBooked.Reason || ''}">
                                <div class="schedule-event__title">${isBooked.Name ? isBooked.Name.split(' ')[0] : 'Reservation'}</div>
                                <div class="schedule-event__meta">Approved reservation</div>
                                <div class="schedule-event__detail">${isBooked.Reason || 'Room reservation'}</div>
                            </div>
                        </td>`;
                        i += (span - 1);
                    } else {
                        gridHTML += `<td class="p-2 border-b border-l border-gray-300 min-w-[100px]"></td>`;
                    }
                }
                gridHTML += `</tr>`;
            });
            gridHTML += `</tbody></table></div>`;
            timetableContainer.innerHTML = gridHTML;
            if (!document.getElementById('compact-schedule-popover')?.hidden) {
                renderCompactSchedule();
            }

            const safeCurrentId = String(currentUser.id).trim();
            const myBookings = globalBookings.filter(b => getUserIdSafe(b) === safeCurrentId);
            
            checkNotifications(myBookings);

            let headerHTML = `
                <div class="flex justify-between items-center mb-4 mt-2 px-1">
                    <h3 class="text-sm font-bold text-gray-700 uppercase tracking-wider">My Reservations History</h3>
                    <button onclick="loadSchedule(true)" class="text-xs bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-bold py-1.5 px-3 rounded-lg shadow-sm transition-colors flex items-center gap-2">
                        <span id="refresh-icon" class="inline-block transition-transform">↻</span> Refresh Status
                    </button>
                </div>`;

            if (myBookings.length === 0) {
                myReservationsContainer.innerHTML = headerHTML + '<div class="p-10 bg-gray-50 rounded-xl text-center border border-dashed border-gray-300"><p class="text-gray-500 font-medium">No reservations submitted by you yet.</p></div>';
                return;
            }

            let myListHTML = headerHTML + `<div class="scroll-wrapper border border-gray-300 rounded-xl shadow-sm bg-white pb-2">
                <table class="w-full min-w-max divide-y divide-gray-200 text-left text-sm border-collapse">
                    <thead class="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider text-[11px]">
                        <tr>
                            <th class="px-5 py-4 border-b border-gray-300 whitespace-nowrap">Room</th>
                            <th class="px-5 py-4 border-b border-gray-300 min-w-[160px]">Date & Time</th>
                            <th class="px-5 py-4 border-b border-gray-300 min-w-[250px] max-w-sm">Purpose / Remarks</th>
                            <th class="px-5 py-4 border-b border-gray-300 text-center whitespace-nowrap">Status</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">`;
            
            myBookings.forEach(b => {
                const parsed = parseStatus(b.Status);
                const statusBadgeHTML = renderStatusBadge(parsed.status);

                let reasonDisplay = b.Reason || '';
                if (parsed.reason) {
                    reasonDisplay += `
                        <div class="mt-3 border-l-2 border-rose-800 pl-3">
                            <span class="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Decline reason</span>
                            <p class="mt-1 text-[11px] leading-relaxed text-gray-700">${parsed.reason}</p>
                        </div>
                    `;
                }

                myListHTML += `<tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-5 py-4 align-top font-bold text-indigo-800 whitespace-nowrap">${b.Room}</td>
                    <td class="px-5 py-4 align-top text-xs text-gray-700">
                        <div class="font-medium">${b.Date}</div>
                        <div class="mt-1 font-mono text-gray-500">${b.TimeRange}</div>
                    </td>
                    <td class="px-5 py-4 align-top text-xs text-gray-600 leading-relaxed break-words max-w-sm">${reasonDisplay}</td>
                    <td class="px-5 py-4 align-top text-center">
                        ${statusBadgeHTML}
                    </td>
                </tr>`;
            });
            myListHTML += `</tbody></table></div>`;
            myReservationsContainer.innerHTML = myListHTML;

        } else {
            if (!isSilent) timetableContainer.innerHTML = `<p class="text-red-500 text-sm font-medium p-4 bg-red-50 rounded-lg border border-red-200 text-center">Error: ${result.message}</p>`;
        }
    } catch (error) {
        if (!isSilent) timetableContainer.innerHTML = `<p class="text-red-500 text-sm font-medium p-4 bg-red-50 rounded-lg border border-red-200 text-center">Connection Error. Please try again.</p>`;
    } finally {
        const rIcon = document.getElementById('refresh-icon');
        if (rIcon) rIcon.classList.remove('animate-spin');
    }
}

document.getElementById('booking-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const reqRoom = document.getElementById('room').value;
    const reqDate = document.getElementById('date').value;
    const reqStart = document.getElementById('startTime').value;
    const reqEnd = document.getElementById('endTime').value;
    const reqDayName = daysOfWeek[new Date(reqDate + 'T00:00:00').getDay()];

    if (reqStart >= reqEnd) {
        alert("❌ ข้อผิดพลาด: เวลาเริ่มต้น ต้องมาก่อนเวลาสิ้นสุดเสมอ");
        return;
    }

    const now = new Date();
    const selectedDateTime = new Date(`${reqDate}T${reqStart}:00`);
    if (selectedDateTime < now) {
        alert("❌ ไม่สามารถจองย้อนหลังหรือในเวลาที่ผ่านไปแล้วได้ครับ");
        return;
    }

    const isClashingTimetable = globalTimetable.find(t => {
        if (t.Room !== reqRoom || t.DayOfWeek.trim().toLowerCase() !== reqDayName.toLowerCase()) return false;
        
        // ✅ เพิ่มลอจิกเช็กภาคการศึกษา ให้ฟอร์มอาจารย์
        if (t.Start_Date && t.End_Date) {
            const checkDate = new Date(reqDate);
            const startDate = new Date(t.Start_Date.trim());
            const endDate = new Date(t.End_Date.trim());
            checkDate.setHours(0,0,0,0); startDate.setHours(0,0,0,0); endDate.setHours(0,0,0,0);
            if (checkDate < startDate || checkDate > endDate) return false;
        }

        if (t.Exception_Dates && t.Exception_Dates.includes(reqDate)) return false; 
        const [tStart, tEnd] = t.TimeRange.split(" - ");
        return (reqStart < tEnd.trim()) && (reqEnd > tStart.trim());
    });

    if (isClashingTimetable) {
        alert(`❌ Booking unavailable! Conflicts with regular class:\nCourse: ${isClashingTimetable.Course_ID} ${isClashingTimetable.Course}\nLecturer: ${isClashingTimetable.Lecturer}`);
        return; 
    }

    const isClashingBooking = globalBookings.find(b => {
        const parsed = parseStatus(b.Status);
        if (b.Room !== reqRoom || b.Date !== reqDate || parsed.status !== "Approved") return false;
        const [bStart, bEnd] = b.TimeRange.split(" - ");
        return (reqStart < bEnd.trim()) && (reqEnd > bStart.trim());
    });

    if (isClashingBooking) {
        alert(`❌ Booking unavailable! Time slot is already reserved by:\n${isClashingBooking.Name}`);
        return; 
    }

    const submitBtn = document.getElementById('submit-btn');
    const originalBtnText = submitBtn.innerText;
    submitBtn.innerHTML = `<div class="flex justify-center items-center"><div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>Processing...</div>`;
    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-75');

    const formData = {
        name: document.getElementById('name').value,
        studentId: document.getElementById('staffId').value, 
        room: reqRoom,
        date: reqDate,
        timeRange: `${reqStart} - ${reqEnd}`,
        reason: document.getElementById('reason').value
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(formData)
        });
        const result = await response.json();
        if (result.status === "success") {
            document.getElementById('reason').value = "";
            document.getElementById('startTime').value = "";
            document.getElementById('endTime').value = "";
            switchTab('my-booking');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            await loadSchedule();
        } else {
            alert("Error: " + result.message);
        }
    } catch (error) {
        alert("Connection failed: " + error.message);
    } finally {
        submitBtn.innerText = originalBtnText;
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-75');
    }
});

function logout() {
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
}

document.getElementById('room').addEventListener('change', function() {
    const selectedRoom = this.value;
    const imageContainer = document.getElementById('room-image-container');
    const roomImage = document.getElementById('room-image');
    
    if (selectedRoom && roomImages[selectedRoom] && roomImages[selectedRoom].trim() !== "") {
        let imageUrl = roomImages[selectedRoom].trim();
        const driveRegex = /drive\.google\.com\/file\/d\/(.*?)\//;
        const match = imageUrl.match(driveRegex);
        if (match && match[1]) {
            imageUrl = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
        }
        roomImage.src = imageUrl; 
        imageContainer.classList.remove('hidden'); 
    } else {
        imageContainer.classList.add('hidden'); 
    }
});


// ==========================================
// 🔑 ระบบเปลี่ยนรหัสผ่าน ฉบับป้องกันความผิดพลาด 100% (Bulletproof Change Password)
// ==========================================
window.openPasswordModal = function() {
    const modal = document.getElementById('password-modal');
    if (modal) {
        modal.classList.remove('hidden');
    } else {
        alert("❌ ไม่สามารถเปิดหน้าต่างได้: หา Element id='password-modal' ไม่พบในหน้า HTML ครับ");
    }
}

window.closePasswordModal = function() {
    const modal = document.getElementById('password-modal');
    const form = document.getElementById('change-password-form');
    if (modal) modal.classList.add('hidden');
    if (form) form.reset();
}

// ฟังก์ชันหลักสำหรับดักจับและส่งข้อมูลเปลี่ยนรหัสผ่าน
window.handleChangePasswordSubmit = async function(e) {
    if (e) e.preventDefault(); // บังคับหยุดการรีเฟรชหน้าจอของเบราว์เซอร์
    
    // ครอบ try...catch ตั้งแต่บรรทัดแรกสุดเพื่อดักจับทุกความผิดพลาดของโครงสร้าง HTML/JS
    try {
        const oldInput = document.getElementById('old-password');
        const newInput = document.getElementById('new-password');
        const confirmInput = document.getElementById('confirm-password');
        const submitBtn = document.getElementById('change-pw-submit-btn');

        // 🔍 ส่วนตรวจสอบความถูกต้องของโครงสร้าง HTML (ถ้าหาไม่เจอจะแจ้งเตือนทันที ไม่นิ่งเงียบ)
        if (!oldInput) throw new Error("หาช่องกรอกรหัสผ่านเดิมไม่เจอ (id='old-password' อาจไม่มีใน HTML)");
        if (!newInput) throw new Error("หาช่องกรอกรหัสผ่านใหม่ไม่เจอ (id='new-password' อาจไม่มีใน HTML)");
        if (!confirmInput) throw new Error("หาช่องยืนยันรหัสผ่านใหม่ไม่เจอ (id='confirm-password' อาจไม่มีใน HTML)");
        if (!submitBtn) throw new Error("หาปุ่มกดอัปเดตรหัสผ่านไม่เจอ (id='change-pw-submit-btn' อาจไม่มีใน HTML)");
        if (!currentUser || !currentUser.id) throw new Error("ไม่พบข้อมูล Session ผู้ใช้งานปัจจุบัน กรุณาลองออกจากระบบและล็อกอินใหม่อีกครั้ง");

        const oldPw = oldInput.value;
        const newPw = newInput.value;
        const confirmPw = confirmInput.value;

        if (!oldPw || !newPw || !confirmPw) {
            alert("❌ กรุณากรอกข้อมูลให้ครบทุกช่องครับ");
            return;
        }

        if (newPw !== confirmPw) {
            alert("❌ รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกันครับ กรุณาตรวจสอบอีกครั้ง");
            return;
        }

        // แสดงสถานะการโหลดที่ปุ่มกด
        const originalText = submitBtn.innerText || "Update Password";
        submitBtn.innerHTML = `<div class="flex justify-center items-center"><div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>Updating...</div>`;
        submitBtn.disabled = true;

        // ส่งข้อมูลไปยัง Google Apps Script Web App
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: "changePassword",
                id: currentUser.id, 
                oldPassword: oldPw,
                newPassword: newPw
            })
        });
        
        const result = await response.json();
        
        // ตรวจสอบข้อมูลขากลับจากลอจิกสคริปต์หลังบ้าน
        if (result.message === "Password updated successfully") {
            alert(`✅ เปลี่ยนรหัสผ่านสำหรับคุณ ${currentUser.name} เรียบร้อยแล้วครับ`);
            logout(); 
        } 
        else if (result.id) {
            // ปรับเป็นข้อความแจ้งเตือนแบบเป็นทางการ ไม่บอกข้อมูลเชิงเทคนิค
            alert("❌ ระบบขัดข้องชั่วคราว: ไม่สามารถอัปเดตรหัสผ่านได้ในขณะนี้ กรุณาลองใหม่อีกครั้งหรือติดต่อผู้ดูแลระบบครับ");
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
        } 
        else {
            alert("❌ ไม่สามารถดำเนินการได้เนื่องจาก: " + result.message);
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
        }

    } catch (error) {
        // หากมีปัญหาใดๆ ฟ้องข้อความออกมาทางหน้าจอตรงๆ ทันที
        alert("❌ JavaScript Error: " + error.message);
        const submitBtn = document.getElementById('change-pw-submit-btn');
        if (submitBtn) {
            submitBtn.innerText = "Update Password";
            submitBtn.disabled = false;
        }
    }
};

// สั่งให้สคริปต์ผูกกับฟอร์มเมื่อหน้าเว็บโหลดเสร็จสิ้น
const changePasswordForm = document.getElementById('change-password-form');
if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', window.handleChangePasswordSubmit);
}
