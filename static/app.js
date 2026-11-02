const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
let toastTimer;

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
  return data;
}

function navigate(page) {
  $$(".page").forEach(p => p.classList.toggle("active", p.id === page));
  $$(".nav").forEach(n => n.classList.toggle("active", n.dataset.page === page));
  
  const names = {
    dashboard: "Dashboard",
    tasks: "My Tasks",
    feedback: "Submit Feedback",
    history: "Feedback History"
  };
  $("page-title").textContent = names[page] || "Dashboard";
  
  if (page === "history") loadFeedback();
  if (page === "tasks") loadTasks();
  if (page === "dashboard") loadDashboard();
}

$$(".nav").forEach(b => b.addEventListener("click", () => navigate(b.dataset.page)));
$$("[data-go]").forEach(b => b.addEventListener("click", () => navigate(b.dataset.go)));

function taskHTML(task) {
  return `<div class="task-row ${task.completed ? 'done' : ''}">
    <input class="task-check" type="checkbox" ${task.completed ? 'checked' : ''} 
           aria-label="Mark task complete" data-toggle="${task.id}">
    <span class="task-name">${escapeHTML(task.title)}</span>
    <button class="delete-task" data-delete="${task.id}" aria-label="Delete task">×</button>
  </div>`;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"]'/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function feedbackHTML(fb) {
  const stars = "★".repeat(fb.rating) + "☆".repeat(5 - fb.rating);
  return `<div class="feedback-item">
    <div class="feedback-head">
      <span class="feedback-category">${escapeHTML(fb.category)}</span>
      <span class="feedback-rating">${stars}</span>
    </div>
    <h4>${escapeHTML(fb.title)}</h4>
    <p>${escapeHTML(fb.description)}</p>
    <div class="feedback-meta">
      <span>${fb.name || 'Anonymous'}</span>
      <span>${fb.email || ''}</span>
      <span>${new Date(fb.created_at).toLocaleDateString()}</span>
    </div>
  </div>`;
}

async function loadTasks() {
  try {
    const data = await api("/api/tasks");
    $("total-tasks").textContent = data.total;
    $("completed-tasks").textContent = data.completed;
    $("pending-tasks").textContent = data.pending;
    $("task-count").textContent = `${data.total} tasks`;
    
    const taskItems = data.items.length ? data.items.map(taskHTML).join("") : 
      '<div class="empty">No tasks yet. Add your first task.</div>';
    
    $("dashboard-tasks").innerHTML = data.items.slice(0, 5).map(taskHTML).join("") || 
      '<div class="empty">No tasks yet. Add your first task.</div>';
    $("all-tasks").innerHTML = taskItems;
  } catch (e) {
    toast(e.message);
  }
}

async function loadDashboard() {
  try {
    const [taskData, feedbackData] = await Promise.all([
      api("/api/tasks"),
      api("/api/feedback?limit=1")
    ]);
    $("total-tasks").textContent = taskData.total;
    $("completed-tasks").textContent = taskData.completed;
    $("pending-tasks").textContent = taskData.pending;
    $("feedback-count").textContent = feedbackData.total;
    
    $("dashboard-tasks").innerHTML = taskData.items.slice(0, 5).map(taskHTML).join("") || 
      '<div class="empty">No tasks yet. Add your first task.</div>';
  } catch (e) {
    toast(e.message);
  }
}

async function loadFeedback() {
  try {
    const data = await api("/api/feedback?limit=50");
    const list = $("feedback-list");
    if (data.items.length === 0) {
      list.innerHTML = '<div class="empty">No feedback yet. Be the first to share!</div>';
      return;
    }
    list.innerHTML = data.items.map(feedbackHTML).join("");
  } catch (e) {
    toast(e.message);
  }
}

document.addEventListener("change", async e => {
  if (e.target.matches("[data-toggle]")) {
    try {
      await api(`/api/tasks/${e.target.dataset.toggle}`, {
        method: "PATCH",
        body: JSON.stringify({ completed: e.target.checked })
      });
      loadTasks();
    } catch (err) {
      toast(err.message);
    }
  }
});

document.addEventListener("click", async e => {
  const id = e.target.dataset.delete;
  if (id) {
    try {
      await api(`/api/tasks/${id}`, { method: "DELETE" });
      loadTasks();
      toast("Task deleted");
    } catch (err) {
      toast(err.message);
    }
  }
});

$("task-form").addEventListener("submit", async e => {
  e.preventDefault();
  const input = $("task-title");
  const title = input.value.trim();
  if (!title) return;
  
  try {
    await api("/api/tasks", {
      method: "POST",
      body: JSON.stringify({ title })
    });
    input.value = "";
    loadTasks();
    toast("Task added!");
  } catch (err) {
    toast(err.message);
  }
});

$("feedback-form").addEventListener("submit", async e => {
  e.preventDefault();
  
  const formData = {
    name: $("fb-name").value.trim() || undefined,
    email: $("fb-email").value.trim() || undefined,
    category: $("fb-category").value,
    title: $("fb-title").value.trim(),
    description: $("fb-description").value.trim(),
    rating: parseInt($("fb-rating").value, 10)
  };
  
  if (!formData.category) {
    toast("Please select a category");
    return;
  }
  if (!formData.title || formData.title.length < 3) {
    toast("Title must be at least 3 characters");
    return;
  }
  if (!formData.description || formData.description.length < 10) {
    toast("Description must be at least 10 characters");
    return;
  }
  if (!formData.rating || formData.rating < 1 || formData.rating > 5) {
    toast("Please select a rating");
    return;
  }
  
  try {
    await api("/api/feedback", {
      method: "POST",
      body: JSON.stringify(formData)
    });
    
    $("feedback-form").reset();
    toast("Feedback submitted! Thank you.");
    
    navigate("dashboard");
  } catch (err) {
    toast(err.message);
  }
});

loadTasks();
