"use strict";

const STORAGE_KEY = "special-days-events";
const THEME_STORAGE_KEY = "special-days-theme";
const eventList = document.querySelector("#event-list");
const themeSelect = document.querySelector("#theme-select");
const eventDialog = document.querySelector("#event-dialog");
const historyDialog = document.querySelector("#history-dialog");
const eventForm = document.querySelector("#event-form");
const nameInput = document.querySelector("#event-name");
const dateInput = document.querySelector("#event-date");
const backgroundImageInput = document.querySelector("#background-image");
const backgroundImagePreview = document.querySelector("#background-image-preview");
const backgroundImagePreviewImage = document.querySelector("#background-image-preview-image");
const clearBackgroundImageButton = document.querySelector("#clear-background-image");
const timeEnabled = document.querySelector("#time-enabled");
const timeInput = document.querySelector("#event-time");
const timeField = document.querySelector("#time-field");
const individualEnabled = document.querySelector("#individual-enabled");
const individualSettings = document.querySelector("#individual-settings");
const recurringEnabled = document.querySelector("#recurring-enabled");
const recurringSettings = document.querySelector("#recurring-settings");
const reminderDays = document.querySelector("#reminder-days");
const formError = document.querySelector("#form-error");
const storageMessage = document.querySelector("#storage-message");
const actionMessage = document.querySelector("#action-message");
const sortSelect = document.querySelector("#sort-select");
const dialogTitle = document.querySelector("#dialog-title");
const dialogEyebrow = document.querySelector("#dialog-eyebrow");
const submitEventButton = document.querySelector("#submit-event");
const historyTitle = document.querySelector("#history-title");
const historyCreated = document.querySelector("#history-created");
const historyList = document.querySelector("#history-list");

let activeFilter = "all";
let editingEventId = null;
let backgroundImageData = "";
let backgroundImageCleared = false;
let backgroundImageObjectUrl = null;
let events = loadEvents();

function getSavedTheme() {
    try {
        const theme = localStorage.getItem(THEME_STORAGE_KEY);
        return [...themeSelect.options].some((option) => option.value === theme) ? theme : "light";
    } catch (error) {
        storageMessage.hidden = false;
        storageMessage.textContent = `テーマ設定を読み込めませんでした: ${error.message}`;
        return "light";
    }
}

function applyTheme(theme, save = false) {
    const option = [...themeSelect.options].find((item) => item.value === theme);
    if (!option) return;

    document.body.dataset.theme = theme;
    themeSelect.value = theme;
    if (!save) return;

    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
        storageMessage.hidden = true;
        storageMessage.textContent = "";
    } catch (error) {
        storageMessage.hidden = false;
        storageMessage.textContent = `テーマ設定を保存できませんでした: ${error.message}`;
    }
}

applyTheme(getSavedTheme());

function loadEvents() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];

    try {
        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) throw new Error("保存データの形式が正しくありません。");
        return parsed.filter((event) =>
            event &&
            typeof event.id === "string" &&
            typeof event.name === "string" &&
            Number.isFinite(event.eventAt) &&
            Number.isFinite(event.createdAt)
        );
    } catch (error) {
        storageMessage.hidden = false;
        storageMessage.textContent = `保存済みイベントを読み込めませんでした: ${error.message}`;
        return [];
    }
}

function saveEvents() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
        storageMessage.hidden = true;
        storageMessage.textContent = "";
    } catch (error) {
        storageMessage.hidden = false;
        storageMessage.textContent = `イベントを保存できませんでした: ${error.message}`;
    }
}

function pad(value) {
    return String(value).padStart(2, "0");
}

function formatDateTime(date) {
    const datePart = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    const timePart = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    return `${datePart} ${timePart}`;
}

function formatEventDate(event) {
    const date = new Date(event.eventAt);
    const hasTime = typeof event.hasTime === "boolean"
        ? event.hasTime
        : date.getHours() !== 0 || date.getMinutes() !== 0 || date.getSeconds() !== 0;
    if (hasTime) return formatDateTime(date);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatHistoryValue(field, value) {
    if (field === "eventAt") return formatDateTime(new Date(value));
    if (field === "reminderDays") {
        return value.length ? value.map((days) => `${days}日後`).join("、") : "設定なし";
    }
    if (field === "recurring") {
        const labels = { monthly: "毎月", yearly: "毎年" };
        return value.length ? value.map((item) => labels[item] || item).join("、") : "設定なし";
    }
    return value || "（空欄）";
}

function reminderSummary(days, recurring) {
    const parts = [];
    if (days.length) parts.push(`個別指定：${days.map((value) => `${value}日後`).join("、")}`);
    if (recurring.length) {
        const labels = { monthly: "毎月", yearly: "毎年" };
        parts.push(`定期：${recurring.map((value) => labels[value] || value).join("、")}`);
    }
    return parts.length ? parts.join(" / ") : "設定なし";
}

function addCalendarYears(date, years) {
    const result = new Date(date);
    const day = result.getDate();
    result.setDate(1);
    result.setFullYear(result.getFullYear() + years);
    result.setDate(Math.min(day, new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()));
    return result;
}

function addCalendarMonths(date, months) {
    const result = new Date(date);
    const day = result.getDate();
    const monthIndex = result.getMonth() + months;
    const targetYear = result.getFullYear() + Math.floor(monthIndex / 12);
    const targetMonth = ((monthIndex % 12) + 12) % 12;
    result.setDate(1);
    result.setFullYear(targetYear, targetMonth, 1);
    result.setDate(Math.min(day, new Date(targetYear, targetMonth + 1, 0).getDate()));
    return result;
}

function addCalendarDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function formatDuration(from, to) {
    let cursor = new Date(from);
    const end = new Date(to);
    let years = 0;
    let months = 0;
    let days = 0;

    while (addCalendarYears(cursor, 1) <= end) {
        cursor = addCalendarYears(cursor, 1);
        years += 1;
    }
    while (addCalendarMonths(cursor, 1) <= end) {
        cursor = addCalendarMonths(cursor, 1);
        months += 1;
    }
    while (addCalendarDays(cursor, 1) <= end) {
        cursor = addCalendarDays(cursor, 1);
        days += 1;
    }

    let seconds = Math.floor((end.getTime() - cursor.getTime()) / 1000);
    const hours = Math.floor(seconds / 3600);
    seconds -= hours * 3600;
    const minutes = Math.floor(seconds / 60);
    seconds -= minutes * 60;

    return `${years}年${months}ヶ月${days}日 ${hours}時間${minutes}分${seconds}秒`;
}

function reminderFor(event, now) {
    if (event.eventAt > now.getTime()) return "";

    const eventDate = new Date(event.eventAt);
    const elapsedDays = Math.floor((now.getTime() - event.eventAt) / 86400000);
    const dayValues = Array.isArray(event.reminderDays) ? event.reminderDays : [];
    const matchedDay = dayValues.find((day) => Number.isInteger(day) && elapsedDays >= day);
    if (matchedDay !== undefined) return `${matchedDay}日経過`;

    const recurring = Array.isArray(event.recurring) ? event.recurring : [];
    const sameDay = now.getDate() === Math.min(
        eventDate.getDate(),
        new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    );
    if (recurring.includes("monthly") && sameDay) return "毎月のリマインド";
    if (
        recurring.includes("yearly") &&
        now.getMonth() === eventDate.getMonth() &&
        now.getDate() === eventDate.getDate()
    ) {
        return "毎年のリマインド";
    }
    return "";
}

function nextIndividualReminderAt(event, now) {
    const reminderDays = Array.isArray(event.reminderDays) ? event.reminderDays : [];
    const upcoming = reminderDays
        .filter((days) => Number.isInteger(days) && days >= 0)
        .map((days) => ({ days, at: event.eventAt + days * 86400000 }))
        .filter((reminder) => reminder.at > now.getTime())
        .sort((a, b) => a.at - b.at);
    return upcoming[0] || null;
}

function isValidBackgroundImage(value) {
    return typeof value === "string" && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function drawCoverImage(context, image, x, y, width, height) {
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const sourceWidth = width / scale;
    const sourceHeight = height / scale;
    const sourceX = (image.naturalWidth - sourceWidth) / 2;
    const sourceY = (image.naturalHeight - sourceHeight) / 2;
    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function loadImage(source) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener("load", () => resolve(image), { once: true });
        image.addEventListener("error", () => reject(new Error("背景画像を読み込めませんでした。")), { once: true });
        image.src = source;
    });
}

async function createEventCardImage(event, now) {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 630;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("カード画像を作成できませんでした。");

    const styles = getComputedStyle(document.body);
    const pageColor = styles.getPropertyValue("--page-bg").trim() || "#f5f7fb";
    const surfaceColor = styles.getPropertyValue("--surface").trim() || "#ffffff";
    const textColor = styles.getPropertyValue("--text").trim() || "#20283a";
    const mutedColor = styles.getPropertyValue("--muted").trim() || "#748096";
    const accentColor = styles.getPropertyValue("--accent").trim() || "#6258e8";
    const highlightColor = styles.getPropertyValue("--highlight-bg").trim() || "#fffdf5";
    const borderColor = styles.getPropertyValue("--highlight-border").trim() || accentColor;
    const isReminder = reminderFor(event, now) !== "";
    const surface = isReminder ? highlightColor : surfaceColor;
    const card = { x: 56, y: 56, width: 1088, height: 518, radius: 34 };

    context.fillStyle = pageColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = surface;
    context.beginPath();
    context.roundRect(card.x, card.y, card.width, card.height, card.radius);
    context.fill();

    if (isValidBackgroundImage(event.backgroundImage)) {
        const image = await loadImage(event.backgroundImage);
        context.save();
        context.beginPath();
        context.roundRect(card.x, card.y, card.width, card.height, card.radius);
        context.clip();
        drawCoverImage(context, image, card.x, card.y, card.width, card.height);
        context.globalAlpha = 0.78;
        context.fillStyle = surface;
        context.fillRect(card.x, card.y, card.width, card.height);
        context.restore();
    }

    context.strokeStyle = isReminder ? borderColor : accentColor;
    context.lineWidth = 4;
    context.beginPath();
    context.roundRect(card.x, card.y, card.width, card.height, card.radius);
    context.stroke();
    context.fillStyle = accentColor;
    context.beginPath();
    context.roundRect(card.x, card.y, 18, card.height, 9);
    context.fill();

    context.fillStyle = accentColor;
    context.font = '800 20px "Noto Sans JP", "Yu Gothic", sans-serif';
    context.textBaseline = "middle";
    context.fillText("MY SPECIAL DAYS", 120, 142);

    const nameFont = '700 58px "Noto Sans JP", "Yu Gothic", sans-serif';
    context.font = nameFont;
    context.fillStyle = textColor;
    const maxWidth = 960;
    const lines = [];
    let line = "";
    for (const character of event.name) {
        const candidate = line + character;
        if (line && context.measureText(candidate).width > maxWidth) {
            lines.push(line);
            line = character;
            if (lines.length === 2) break;
        } else {
            line = candidate;
        }
    }
    if (line && lines.length < 2) lines.push(line);
    if (lines.length === 2 && context.measureText(lines[1]).width > maxWidth) {
        while (lines[1] && context.measureText(`${lines[1]}…`).width > maxWidth) {
            lines[1] = lines[1].slice(0, -1);
        }
        lines[1] += "…";
    }
    const nameStartY = lines.length > 1 ? 270 : 300;
    lines.forEach((nameLine, index) => {
        context.fillText(nameLine, 120, nameStartY + index * 76);
    });

    context.font = '600 34px "Noto Sans JP", "Yu Gothic", sans-serif';
    context.fillStyle = isReminder ? borderColor : mutedColor;
    context.fillText(formatEventDate(event), 120, 450);

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error("カード画像を保存できませんでした。"));
                return;
            }
            resolve(blob);
        }, "image/jpeg", 0.92);
    });
}

function showActionMessage(message) {
    actionMessage.textContent = message;
    actionMessage.hidden = false;
}

function searchEvent(event) {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(event.name)}`;
    window.open(searchUrl, "_blank", "noopener,noreferrer");
}

async function saveEventCardImage(event, button) {
    button.disabled = true;
    try {
        const blob = await createEventCardImage(event, new Date());
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `special-day-${event.id.replace(/[^a-zA-Z0-9_-]/g, "") || "event"}.jpg`;
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        showActionMessage("イベントカードをJPEG画像で保存しました。");
    } catch (error) {
        showActionMessage(`カード画像を保存できませんでした: ${error.message}`);
    } finally {
        button.disabled = false;
    }
}

function createCard(event, now) {
    const isFuture = event.eventAt > now.getTime();
    const eventDate = new Date(event.eventAt);
    const reminder = reminderFor(event, now);
    const card = document.createElement("article");
    card.className = `event-card${reminder ? " is-reminder" : ""}`;
    if (isValidBackgroundImage(event.backgroundImage)) {
        const overlay = reminder ? "var(--highlight-bg)" : "var(--surface)";
        card.classList.add("has-background-image");
        card.style.backgroundImage = `linear-gradient(color-mix(in srgb, ${overlay} 78%, transparent), color-mix(in srgb, ${overlay} 78%, transparent)), url("${event.backgroundImage}")`;
    }

    const topLine = document.createElement("div");
    topLine.className = "card-topline";
    const titleArea = document.createElement("div");
    const title = document.createElement("h2");
    title.className = "event-name";
    title.textContent = event.name;
    const date = document.createElement("p");
    date.className = "event-date";
    date.textContent = formatEventDate(event);
    titleArea.append(title, date);

    const actions = document.createElement("div");
    actions.className = "card-actions";

    const editButton = createIconButton("card-action", `「${event.name}」を編集`, "edit");
    editButton.addEventListener("click", () => openEditDialog(event));
    const historyButton = document.createElement("button");
    historyButton.className = "card-action log-button";
    historyButton.type = "button";
    historyButton.setAttribute("aria-label", `「${event.name}」の編集ログを表示`);
    historyButton.title = "編集ログ";
    historyButton.textContent = "ログ";
    historyButton.addEventListener("click", () => openHistoryDialog(event));
    const deleteButton = createIconButton("delete-button", `「${event.name}」を削除`, "delete");
    deleteButton.addEventListener("click", () => {
        events = events.filter((item) => item.id !== event.id);
        saveEvents();
        render();
    });
    actions.append(editButton, historyButton, deleteButton);
    topLine.append(titleArea, actions);

    const label = document.createElement("p");
    label.className = "timer-label";
    label.textContent = isFuture ? "イベントまであと" : "イベントから経過";
    const timer = document.createElement("p");
    timer.className = "timer";
    timer.textContent = isFuture
        ? formatDuration(now, eventDate)
        : formatDuration(eventDate, now);
    card.append(topLine, label, timer);

    const nextReminder = nextIndividualReminderAt(event, now);
    if (nextReminder) {
        const reminderCountdownLabel = document.createElement("p");
        reminderCountdownLabel.className = "timer-label reminder-countdown-label";
        reminderCountdownLabel.textContent = `次の個別リマインド：イベントから${nextReminder.days}日後`;
        const reminderCountdown = document.createElement("p");
        reminderCountdown.className = "timer reminder-countdown";
        reminderCountdown.textContent = formatDuration(now, new Date(nextReminder.at));
        card.append(reminderCountdownLabel, reminderCountdown);
    }

    if (reminder) {
        const badge = document.createElement("span");
        badge.className = "reminder-badge";
        badge.textContent = `リマインド：${reminder}`;
        card.append(badge);
    }

    const added = document.createElement("p");
    added.className = "added-date";
    added.textContent = `追加日：${formatDateTime(new Date(event.createdAt))}`;
    const footer = document.createElement("div");
    footer.className = "card-footer";
    const cardActions = document.createElement("div");
    cardActions.className = "card-export-actions";
    const googleButton = createIconButton("card-action export-action google-action", `「${event.name}」をGoogleで検索`, "google");
    googleButton.addEventListener("click", () => searchEvent(event));
    const saveButton = createIconButton("card-action export-action", `「${event.name}」のカード画像を保存`, "save");
    saveButton.addEventListener("click", () => saveEventCardImage(event, saveButton));
    cardActions.append(googleButton, saveButton);
    footer.append(added, cardActions);
    card.append(footer);
    return card;
}

function createIconButton(className, label, icon) {
    const button = document.createElement("button");
    button.className = className;
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.title = {
        edit: "編集",
        google: "Googleで検索",
        save: "カード画像を保存"
    }[icon] || "削除";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    if (icon === "google") {
        const letter = document.createElementNS("http://www.w3.org/2000/svg", "text");
        letter.setAttribute("x", "3");
        letter.setAttribute("y", "20");
        letter.setAttribute("font-size", "22");
        letter.setAttribute("font-family", "Arial, sans-serif");
        letter.setAttribute("font-weight", "700");
        letter.textContent = "G";
        svg.append(letter);
        button.append(svg);
        return button;
    }
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    if (icon === "edit") {
        path.setAttribute("d", "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z");
    } else if (icon === "save") {
        path.setAttribute("d", "M5 3h12l4 4v14H3V3h2Zm2 0v6h10V3M7 21v-8h10v8");
    } else {
        path.setAttribute("d", "M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m5 4v6m4-6v6");
    }
    svg.append(path);
    button.append(svg);
    return button;
}

function openEditDialog(event) {
    resetForm();
    editingEventId = event.id;
    dialogEyebrow.textContent = "EDIT EVENT";
    dialogTitle.textContent = "イベントを編集";
    submitEventButton.textContent = "変更を保存";
    nameInput.value = event.name;
    backgroundImageData = isValidBackgroundImage(event.backgroundImage) ? event.backgroundImage : "";
    updateBackgroundImagePreview(backgroundImageData);

    const eventDate = new Date(event.eventAt);
    dateInput.value = `${eventDate.getFullYear()}-${pad(eventDate.getMonth() + 1)}-${pad(eventDate.getDate())}`;
    timeEnabled.checked = typeof event.hasTime === "boolean"
        ? event.hasTime
        : eventDate.getHours() !== 0 || eventDate.getMinutes() !== 0 || eventDate.getSeconds() !== 0;
    timeField.hidden = !timeEnabled.checked;
    timeInput.disabled = !timeEnabled.checked;
    timeInput.value = `${pad(eventDate.getHours())}:${pad(eventDate.getMinutes())}:${pad(eventDate.getSeconds())}`;

    const savedDays = Array.isArray(event.reminderDays) ? event.reminderDays : [];
    individualEnabled.checked = savedDays.length > 0;
    individualSettings.hidden = !individualEnabled.checked;
    savedDays.forEach((days) => addReminderDay(String(days)));

    const savedRecurring = Array.isArray(event.recurring) ? event.recurring : [];
    recurringEnabled.checked = savedRecurring.length > 0;
    recurringSettings.hidden = !recurringEnabled.checked;
    recurringSettings.querySelectorAll('input[name="recurring"]').forEach((input) => {
        input.checked = savedRecurring.includes(input.value);
    });

    eventDialog.showModal();
    nameInput.focus();
}

function openHistoryDialog(event) {
    historyTitle.textContent = `${event.name} の編集ログ`;
    historyCreated.textContent = `作成日時：${formatDateTime(new Date(event.createdAt))}`;
    historyList.replaceChildren();

    const history = Array.isArray(event.history) ? event.history : [];
    if (history.length === 0) {
        const empty = document.createElement("li");
        empty.className = "history-empty";
        empty.textContent = "作成日時以降の編集履歴はありません。";
        historyList.append(empty);
    } else {
        [...history].reverse().forEach((entry) => {
            const item = document.createElement("li");
            item.className = "history-item";
            const time = document.createElement("time");
            time.dateTime = new Date(entry.editedAt).toISOString();
            time.textContent = formatDateTime(new Date(entry.editedAt));
            const changes = document.createElement("ul");
            entry.changes.forEach((change) => {
                const changeItem = document.createElement("li");
                changeItem.textContent = `${change.label}：${change.before} → ${change.after}`;
                changes.append(changeItem);
            });
            item.append(time, changes);
            historyList.append(item);
        });
    }
    historyDialog.showModal();
}

function render() {
    const now = new Date();
    const filtered = events.filter((event) => {
        const isFuture = event.eventAt > now.getTime();
        const isReminding = reminderFor(event, now) !== "";
        return activeFilter === "all" ||
            (activeFilter === "future" && isFuture) ||
            (activeFilter === "past" && !isFuture) ||
            (activeFilter === "reminding" && isReminding);
    });
    const sortMode = sortSelect.value;
    filtered.sort((a, b) => {
        if (sortMode === "event-asc") return a.eventAt - b.eventAt;
        if (sortMode === "created-desc") return b.createdAt - a.createdAt;
        if (sortMode === "created-asc") return a.createdAt - b.createdAt;
        return b.eventAt - a.eventAt;
    });

    eventList.replaceChildren();
    if (filtered.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        const heading = document.createElement("strong");
        heading.textContent = events.length === 0
            ? "イベントはまだありません"
            : activeFilter === "reminding"
                ? "リマインド中のイベントはありません"
                : "該当するイベントはありません";
        const description = document.createElement("p");
        description.textContent = events.length === 0
            ? "右上の「＋」からイベントを追加しましょう。"
            : activeFilter === "reminding"
                ? "現在リマインド条件に該当するイベントはありません。"
            : "別のタブを選ぶか、新しいイベントを追加してください。";
        empty.append(heading, description);
        eventList.append(empty);
        return;
    }
    filtered.forEach((event) => eventList.append(createCard(event, now)));
}

function addReminderDay(value = "") {
    const row = document.createElement("div");
    row.className = "reminder-day-row";
    const input = document.createElement("input");
    input.className = "day-input";
    input.type = "number";
    input.min = "0";
    input.max = "365000";
    input.step = "1";
    input.placeholder = "例：7";
    input.setAttribute("aria-label", "イベントからの日数");
    input.value = value;
    const suffix = document.createElement("span");
    suffix.className = "day-suffix";
    suffix.textContent = "日後";
    const remove = document.createElement("button");
    remove.className = "remove-day";
    remove.type = "button";
    remove.setAttribute("aria-label", "この日数を削除");
    remove.textContent = "×";
    remove.addEventListener("click", () => row.remove());
    row.append(input, suffix, remove);
    reminderDays.append(row);
}

function updateBackgroundImagePreview(source) {
    backgroundImagePreview.hidden = !source;
    if (source) backgroundImagePreviewImage.src = source;
    else backgroundImagePreviewImage.removeAttribute("src");
}

function revokeBackgroundImageObjectUrl() {
    if (!backgroundImageObjectUrl) return;
    URL.revokeObjectURL(backgroundImageObjectUrl);
    backgroundImageObjectUrl = null;
}

async function readBackgroundImage(file) {
    if (!file.type.startsWith("image/")) throw new Error("画像ファイルを選択してください。");
    if (file.size > 10 * 1024 * 1024) throw new Error("画像は10MB以下のファイルを選択してください。");

    const source = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => resolve(reader.result));
        reader.addEventListener("error", () => reject(new Error("画像ファイルを読み込めませんでした。")));
        reader.readAsDataURL(file);
    });
    const image = new Image();
    await new Promise((resolve, reject) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", () => reject(new Error("画像ファイルを開けませんでした。")), { once: true });
        image.src = source;
    });

    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("画像を処理できませんでした。");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
}

function resetForm() {
    eventForm.reset();
    editingEventId = null;
    backgroundImageData = "";
    backgroundImageCleared = false;
    revokeBackgroundImageObjectUrl();
    updateBackgroundImagePreview("");
    dialogEyebrow.textContent = "NEW EVENT";
    dialogTitle.textContent = "イベントを追加";
    submitEventButton.textContent = "追加する";
    reminderDays.replaceChildren();
    timeField.hidden = true;
    timeInput.disabled = true;
    individualSettings.hidden = true;
    recurringSettings.hidden = true;
    formError.textContent = "";
}

document.querySelector("#open-dialog").addEventListener("click", () => {
    resetForm();
    const today = new Date();
    dateInput.value = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    eventDialog.showModal();
    nameInput.focus();
});

document.querySelector("#close-dialog").addEventListener("click", () => eventDialog.close());
document.querySelector("#cancel-dialog").addEventListener("click", () => eventDialog.close());
document.querySelector("#close-history").addEventListener("click", () => historyDialog.close());
document.querySelector("#add-reminder-day").addEventListener("click", () => addReminderDay());

backgroundImageInput.addEventListener("change", () => {
    const file = backgroundImageInput.files[0];
    backgroundImageCleared = false;
    revokeBackgroundImageObjectUrl();
    if (!file) {
        updateBackgroundImagePreview(backgroundImageData);
        return;
    }
    backgroundImageObjectUrl = URL.createObjectURL(file);
    updateBackgroundImagePreview(backgroundImageObjectUrl);
});

clearBackgroundImageButton.addEventListener("click", () => {
    backgroundImageInput.value = "";
    backgroundImageData = "";
    backgroundImageCleared = true;
    revokeBackgroundImageObjectUrl();
    updateBackgroundImagePreview("");
});

timeEnabled.addEventListener("change", () => {
    timeField.hidden = !timeEnabled.checked;
    timeInput.disabled = !timeEnabled.checked;
});

individualEnabled.addEventListener("change", () => {
    individualSettings.hidden = !individualEnabled.checked;
    if (individualEnabled.checked && reminderDays.childElementCount === 0) addReminderDay();
});

recurringEnabled.addEventListener("change", () => {
    recurringSettings.hidden = !recurringEnabled.checked;
});

eventForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    formError.textContent = "";

    const name = nameInput.value.trim();
    const dateParts = dateInput.value.split("-").map(Number);
    if (!name || dateParts.length !== 3 || dateParts.some((part) => !Number.isInteger(part))) {
        formError.textContent = "イベント名と日付を入力してください。";
        return;
    }

    const timeParts = timeEnabled.checked
        ? timeInput.value.split(":").map(Number)
        : [0, 0, 0];
    if (timeParts.length < 2 || timeParts.some((part) => !Number.isInteger(part))) {
        formError.textContent = "時刻を正しく入力してください。";
        return;
    }
    const [year, month, day] = dateParts;
    const [hour, minute, second = 0] = timeParts;
    const eventDate = new Date(year, month - 1, day, hour, minute, second);
    if (
        eventDate.getFullYear() !== year ||
        eventDate.getMonth() !== month - 1 ||
        eventDate.getDate() !== day
    ) {
        formError.textContent = "存在する日付を入力してください。";
        return;
    }

    const dayInputs = [...reminderDays.querySelectorAll(".day-input")];
    const reminderDayValues = [];
    if (individualEnabled.checked) {
        for (const input of dayInputs) {
            if (input.value === "" || !Number.isInteger(Number(input.value)) || Number(input.value) < 0) {
                formError.textContent = "個別指定の日数は0以上の整数で入力してください。";
                input.focus();
                return;
            }
            reminderDayValues.push(Number(input.value));
        }
        if (reminderDayValues.length === 0) {
            formError.textContent = "個別指定の日数を1つ以上追加してください。";
            return;
        }
    }

    const recurringValues = recurringEnabled.checked
        ? [...recurringSettings.querySelectorAll('input[name="recurring"]:checked')].map((input) => input.value)
        : [];
    if (recurringEnabled.checked && recurringValues.length === 0) {
        formError.textContent = "定期リマインドは「毎月」か「毎年」を選択してください。";
        return;
    }

    let selectedBackgroundImage = backgroundImageCleared ? "" : backgroundImageData;
    const backgroundImageFile = backgroundImageInput.files[0];
    if (backgroundImageFile) {
        submitEventButton.disabled = true;
        try {
            selectedBackgroundImage = await readBackgroundImage(backgroundImageFile);
        } catch (error) {
            formError.textContent = `背景画像を読み込めませんでした: ${error.message}`;
            return;
        } finally {
            submitEventButton.disabled = false;
        }
    }

    const eventAt = eventDate.getTime();
    const now = Date.now();
    if (editingEventId) {
        const existing = events.find((item) => item.id === editingEventId);
        if (!existing) {
            formError.textContent = "編集対象のイベントが見つかりません。";
            return;
        }

        const changes = [];
        if (existing.name !== name) {
            changes.push({ label: "イベント名", before: formatHistoryValue("name", existing.name), after: formatHistoryValue("name", name) });
        }
        if (existing.eventAt !== eventAt) {
            changes.push({ label: "イベント日時", before: formatHistoryValue("eventAt", existing.eventAt), after: formatHistoryValue("eventAt", eventAt) });
        }
        const oldBackgroundImage = isValidBackgroundImage(existing.backgroundImage) ? existing.backgroundImage : "";
        if (oldBackgroundImage !== selectedBackgroundImage) {
            const before = oldBackgroundImage ? "設定あり" : "設定なし";
            const after = oldBackgroundImage && selectedBackgroundImage
                ? "別の画像に変更"
                : selectedBackgroundImage
                    ? "設定あり"
                    : "設定なし";
            changes.push({ label: "背景画像", before, after });
        }
        const oldDays = Array.isArray(existing.reminderDays) ? existing.reminderDays : [];
        if (JSON.stringify(oldDays) !== JSON.stringify(reminderDayValues)) {
            changes.push({ label: "リマインド設定", before: reminderSummary(oldDays, Array.isArray(existing.recurring) ? existing.recurring : []), after: reminderSummary(reminderDayValues, recurringValues) });
        } else {
            const oldRecurring = Array.isArray(existing.recurring) ? existing.recurring : [];
            if (JSON.stringify(oldRecurring) !== JSON.stringify(recurringValues)) {
                changes.push({ label: "リマインド設定", before: reminderSummary(oldDays, oldRecurring), after: reminderSummary(reminderDayValues, recurringValues) });
            }
        }

        if (changes.length > 0) {
            existing.history = Array.isArray(existing.history) ? existing.history : [];
            existing.history.push({ editedAt: now, changes });
        }
        existing.name = name;
        existing.eventAt = eventAt;
        existing.backgroundImage = selectedBackgroundImage;
        existing.hasTime = timeEnabled.checked;
        existing.reminderDays = reminderDayValues;
        existing.recurring = recurringValues;
    } else {
        events.push({
            id: window.crypto && typeof window.crypto.randomUUID === "function"
                ? window.crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            name,
            eventAt,
                backgroundImage: selectedBackgroundImage,
                hasTime: timeEnabled.checked,
            createdAt: now,
            reminderDays: reminderDayValues,
            recurring: recurringValues,
            history: []
        });
    }
    saveEvents();
    eventDialog.close();
    render();
});

document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
        activeFilter = tab.dataset.filter;
        document.querySelectorAll(".tab").forEach((item) => {
            const isActive = item === tab;
            item.classList.toggle("is-active", isActive);
            item.setAttribute("aria-selected", String(isActive));
        });
        render();
    });
});

sortSelect.addEventListener("change", render);
themeSelect.addEventListener("change", () => applyTheme(themeSelect.value, true));

render();
window.setInterval(render, 1000);
