let dishes = [];
const dayNames = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"];
const menuList = document.getElementById("menuList");
const weekLabel = document.getElementById("weekLabel");
const statusMessage = document.getElementById("statusMessage");
let currentWeek = getMonday(new Date());
let currentMenu = [];

async function loadDishes() {
  const response = await fetch("klassieke-vlaamse-gerechten.md", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Gerechtenbestand laden mislukt (${response.status}).`);
  }

  const markdown = await response.text();
  const parsedDishes = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.replace(/^(?:[-*+]\s+|\d+[.)]\s+)/, "").trim())
    .filter(Boolean);

  dishes = [...new Set(parsedDishes)];
  if (dishes.length < 7) {
    throw new Error("Het Markdown-bestand moet minstens zeven gerechten bevatten.");
  }
}

function getMonday(date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = monday.getDay();
  monday.setDate(monday.getDate() + (day === 0 ? -6 : 1 - day));
  return monday;
}

function shiftWeek(date, numberOfWeeks) {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + numberOfWeeks * 7);
  return shifted;
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function storageKey(date) {
  return `tafelplan-${dateKey(date)}`;
}

function readMenu(date) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(date)));
    if (Array.isArray(saved) && saved.length === 7 && saved.every((dish) => dishes.includes(dish))) {
      return saved;
    }
  } catch {
    return null;
  }

  return null;
}

function saveMenu() {
  localStorage.setItem(storageKey(currentWeek), JSON.stringify(currentMenu));
}

function shuffled(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function createMenu(excludeCurrent = false) {
  const excluded = new Set(readMenu(shiftWeek(currentWeek, -1)) || []);
  if (excludeCurrent) {
    currentMenu.forEach((dish) => excluded.add(dish));
  }

  let available = dishes.filter((dish) => !excluded.has(dish));
  if (available.length < 7) {
    available = dishes.filter((dish) => !excludeCurrent || !currentMenu.includes(dish));
  }

  return shuffled(available).slice(0, 7);
}

function formatDate(date, options) {
  return new Intl.DateTimeFormat("nl-BE", options).format(date);
}

function updateWeekLabel() {
  const weekEnd = shiftWeek(currentWeek, 1);
  weekEnd.setDate(weekEnd.getDate() - 1);
  const start = formatDate(currentWeek, { day: "numeric", month: "long" });
  const end = formatDate(weekEnd, { day: "numeric", month: "long", year: "numeric" });
  weekLabel.textContent = `${start} – ${end}`;
}

function renderMenu() {
  menuList.replaceChildren();

  currentMenu.forEach((dish, index) => {
    const date = new Date(currentWeek);
    date.setDate(date.getDate() + index);

    const row = document.createElement("article");
    row.className = "menu-row";

    const day = document.createElement("div");
    day.className = "day-label";

    const dayNumber = document.createElement("span");
    dayNumber.className = "day-number";
    dayNumber.textContent = String(index + 1).padStart(2, "0");

    const dayText = document.createElement("div");
    dayText.className = "day-text";
    const name = document.createElement("span");
    name.className = "day-name";
    name.textContent = dayNames[index];
    const dateText = document.createElement("span");
    dateText.className = "day-date";
    dateText.textContent = formatDate(date, { day: "numeric", month: "short" });
    dayText.append(name, dateText);
    day.append(dayNumber, dayText);

    const select = document.createElement("select");
    select.className = "dish-select";
    select.setAttribute("aria-label", `Gerecht voor ${dayNames[index]}`);
    dishes.forEach((optionDish) => {
      const option = document.createElement("option");
      option.value = optionDish;
      option.textContent = optionDish;
      option.selected = optionDish === dish;
      option.disabled = optionDish !== dish && currentMenu.includes(optionDish);
      select.append(option);
    });
    const dishChoice = document.createElement("div");
    dishChoice.className = "dish-choice";
    const dishName = document.createElement("span");
    dishName.className = "dish-name";
    dishName.textContent = dish;
    dishChoice.append(dishName, select);
    select.addEventListener("change", () => {
      currentMenu[index] = select.value;
      saveMenu();
      renderMenu();
      statusMessage.textContent = `${dayNames[index]} aangepast.`;
    });

    const replaceButton = document.createElement("button");
    replaceButton.className = "replace-button";
    replaceButton.type = "button";
    replaceButton.title = `Vervang gerecht voor ${dayNames[index]}`;
    replaceButton.setAttribute("aria-label", replaceButton.title);
    replaceButton.textContent = "↻";
    replaceButton.addEventListener("click", () => {
      const excluded = new Set([...currentMenu, ...(readMenu(shiftWeek(currentWeek, -1)) || [])]);
      let alternatives = shuffled(dishes.filter((candidate) => !excluded.has(candidate)));
      if (alternatives.length === 0) {
        alternatives = shuffled(dishes.filter((candidate) => !currentMenu.includes(candidate)));
      }
      currentMenu[index] = alternatives[0];
      saveMenu();
      renderMenu();
      statusMessage.textContent = `${dayNames[index]} heeft een ander gerecht gekregen.`;
    });

    row.append(day, dishChoice, replaceButton);
    menuList.append(row);
  });
}

function openWeek(date) {
  currentWeek = date;
  currentMenu = readMenu(currentWeek) || createMenu();
  saveMenu();
  updateWeekLabel();
  renderMenu();
  statusMessage.textContent = "";
}

document.getElementById("previousWeek").addEventListener("click", () => {
  openWeek(shiftWeek(currentWeek, -1));
});

document.getElementById("nextWeek").addEventListener("click", () => {
  openWeek(shiftWeek(currentWeek, 1));
});

document.getElementById("newMenu").addEventListener("click", () => {
  currentMenu = createMenu(true);
  saveMenu();
  renderMenu();
  statusMessage.textContent = "Je nieuwe weekmenu is klaar.";
});

async function initializePlanner() {
  try {
    await loadDishes();
    openWeek(currentWeek);
  } catch (error) {
    console.error(error);
    statusMessage.textContent = "De gerechtenlijst kon niet worden geladen. Open de planner via de lokale webserver en controleer of het Markdown-bestand naast index.html staat.";
  }
}

initializePlanner();
