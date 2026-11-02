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
  return String(value).replace(/[&<>"']/g, c => ({
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
    
    $("dashboard-tasks").innerHTML = data.items.slice(0, 5).map(taskHTML).join("");
    $("tasks-list").innerHTML = taskItems;
    
    attachTaskListeners();
  } catch (e) {
    console.error(e);
    toast("Failed to load tasks");
  }
}

function attachTaskListeners() {
  $$(".task-check").forEach(cb => {
    cb.onchange = async () => {
      try {
        await api(`/api/tasks/${cb.dataset.toggle}`, {
          method: "PATCH",
          body: JSON.stringify({ completed: cb.checked })
        });
        loadTasks();
        loadDashboard();
      } catch (e) {
        cb.checked = !cb.checked;
        toast(e.message);
      }
    };
  });
  $$(".delete-task").forEach(btn => {
    btn.onclick = async () => {
      if (!confirm("Delete this task?")) return;
      try {
        await api(`/api/tasks/${btn.dataset.delete}`, { method: "DELETE" });
        loadTasks();
        loadDashboard();
      } catch (e) {
        toast(e.message);
      }
    };
  });
}

async function loadDashboard() {
  try {
    const [tasks, feedback] = await Promise.all([
      api("/api/tasks"),
      api("/api/feedback/stats")
    ]);
    $("total-tasks").textContent = tasks.total;
    $("completed-tasks").textContent = tasks.completed;
    $("pending-tasks").textContent = tasks.pending;
    $("feedback-count").textContent = feedback.total;
    $("dashboard-tasks").innerHTML = tasks.items.slice(0, 5).map(taskHTML).join("");
    attachTaskListeners();
  } catch (e) {
    console.error(e);
  }
}

async function loadFeedback() {
  try {
    const data = await api("/api/feedback?limit=100");
    $("feedback-list").innerHTML = data.items.length
      ? data.items.map(feedbackHTML).join("")
      : '<div class="empty">No feedback submitted yet.</div>';
  } catch (e) {
    console.error(e);
    toast("Failed to load feedback");
  }
}

async function submitFeedback(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting...";
  
  try {
    const payload = {
      name: form.name.value.trim() || null,
      email: form.email.value.trim() || null,
      category: form.category.value,
      title: form.title.value.trim(),
      description: form.description.value.trim(),
      rating: parseInt(form.rating.value, 10)
    };
    
    await api("/api/feedback", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    
    toast("Feedback submitted successfully!");
    form.reset();
    $("rating-value").textContent = "3";
    navigate("history");
  } catch (err) {
    toast(err.message || "Failed to submit feedback");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

async function addTask(e) {
  e.preventDefault();
  const input = $("new-task-input");
  const title = input.value.trim();
  if (!title) return;
  try {
    await api("/api/tasks", { method: "POST", body: JSON.stringify({ title }) });
    input.value = "";
    loadTasks();
    loadDashboard();
  } catch (e) {
    toast(e.message);
  }
}

$("feedback-form").addEventListener("submit", submitFeedback);
$("task-form").addEventListener("submit", addTask);

$("rating").addEventListener("input", (e) => {
  $("rating-value").textContent = e.target.value;
});

navigate("dashboard");