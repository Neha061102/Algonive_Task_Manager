import { openDB } from "https://unpkg.com/idb?module";

let tasks = [];
let db;
let currentEditId = null; // NEW

// Open IndexedDB
const dbPromise = openDB("task-db", 1, {
  upgrade(db) {
    db.createObjectStore("tasks", { keyPath: "id" });
  }
});

// Load from DB
async function loadTasksFromDB() {
  db = await dbPromise;
  const all = await db.getAll("tasks");
  tasks = all;
  renderTasks();
  notifyUpcomingTasks();
}

// Save to DB
async function saveTasksToDB() {
  const tx = db.transaction("tasks", "readwrite");
  const store = tx.objectStore("tasks");
  await store.clear();
  for (let task of tasks) {
    await store.put(task);
  }
  await tx.done;
}

// Task Add / Edit Handler
document.getElementById("task-form").addEventListener("submit", async function (e) {
  e.preventDefault();
  const title = document.getElementById("title").value;
  const description = document.getElementById("description").value;
  const dueDate = document.getElementById("due-date").value;
  const recurrence = document.getElementById("recurrence").value;

  if (currentEditId) {
    // Update existing task
    const index = tasks.findIndex(t => t.id === currentEditId);
    if (index !== -1) {
      tasks[index] = { ...tasks[index], title, description, dueDate, recurrence };
    }
    currentEditId = null;
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Task updated!',
      showConfirmButton: false,
      timer: 2000
    });
  } else {
    // Add new task
    tasks.push({
      id: Date.now(),
      title,
      description,
      dueDate,
      recurrence,
      completed: false,
    });
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Task added!',
      showConfirmButton: false,
      timer: 2000
    });
  }

  await saveTasksToDB();
  renderTasks();
  this.reset();
});

// Render Tasks
function renderTasks(filter = "all") {
  const taskList = document.getElementById("task-list");
  taskList.innerHTML = "";
  const now = new Date();
  const upcoming = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

  tasks.forEach((task) => {
    if ((filter === "active" && task.completed) || (filter === "completed" && !task.completed)) return;

    const due = new Date(task.dueDate);
    const li = document.createElement("li");
    li.className = "list-group-item d-flex justify-content-between flex-column flex-md-row";

    if (task.completed) li.classList.add("bg-success-subtle", "text-decoration-line-through");
    else if (due <= upcoming) li.classList.add("border-warning");

    li.innerHTML = `
      <div class="me-auto">
        <strong>${task.title}</strong><br/>
        <small>${task.description}</small><br/>
        <span class="badge bg-info text-dark me-1">Due: ${task.dueDate}</span>
        ${task.recurrence !== "none" ? `<span class="badge bg-secondary">${task.recurrence}</span>` : ""}
      </div>
      <div class="mt-2 mt-md-0">
        <input type="checkbox" class="form-check-input me-2" ${task.completed ? "checked" : ""} onchange="toggleTask(${task.id})"/>
        <button class="btn btn-sm btn-warning me-1" onclick="editTask(${task.id})">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteTask(${task.id})">Delete</button>
      </div>
    `;
    taskList.appendChild(li);
  });
}

window.toggleTask = async function(id) {
  const index = tasks.findIndex(t => t.id === id);
  if (index === -1) return;

  const task = tasks[index];
  task.completed = !task.completed;

  if (task.completed && task.recurrence !== "none") {
    const nextDate = getNextDate(task.dueDate, task.recurrence);
    tasks.push({ ...task, id: Date.now(), dueDate: nextDate, completed: false });
  }

  await saveTasksToDB();
  renderTasks();
};

// EDIT BUTTON LOGIC (UPDATED)
window.editTask = function(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  document.getElementById("title").value = task.title;
  document.getElementById("description").value = task.description;
  document.getElementById("due-date").value = task.dueDate;
  document.getElementById("recurrence").value = task.recurrence;
  currentEditId = id;
};

window.deleteTask = function(id) {
  const task = tasks.find(t => t.id === id);
  Swal.fire({
    title: `Delete "${task.title}"?`,
    text: "You won’t be able to recover this.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Yes, delete it!",
    confirmButtonColor: "#d33"
  }).then(async (result) => {
    if (result.isConfirmed) {
      tasks = tasks.filter(t => t.id !== id);
      await saveTasksToDB();
      renderTasks();
      Swal.fire("Deleted!", "Task has been removed.", "success");
    }
  });
};

function getNextDate(dateStr, recurrence) {
  const date = new Date(dateStr);
  if (recurrence === "daily") date.setDate(date.getDate() + 1);
  else if (recurrence === "weekly") date.setDate(date.getDate() + 7);
  return date.toISOString().split("T")[0];
}

window.filterTasks = function(type, btn) {
  document.querySelectorAll(".my-3 button").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderTasks(type);
};




function notifyUpcomingTasks() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") Notification.requestPermission();

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  tasks.forEach(task => {
    const due = new Date(task.dueDate);
    if (!task.completed && (isSameDate(due, now) || isSameDate(due, tomorrow))) {
      showNotification(task.title, task.dueDate);
    }
  });
}

function isSameDate(d1, d2) {
  return d1.getDate() === d2.getDate() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getFullYear() === d2.getFullYear();
}

function showNotification(title, dueDate) {
  if (Notification.permission === "granted") {
    new Notification("⏰ Task Due Soon", {
      body: `${title} is due by ${dueDate}`,
      icon: "https://cdn-icons-png.flaticon.com/512/1159/1159633.png"
    });

    const audio = document.getElementById("notify-sound");
    if (audio) {
      audio.play().catch(() => console.log("Click the page to allow sound."));
    }
  }
}

window.onload = loadTasksFromDB;
