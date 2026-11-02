const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
let toastTimer;
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2600)};
async function api(url, options={}) {
  const res=await fetch(url,{headers:{"Content-Type":"application/json",...(options.headers||{})},...options});
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
  return data;
}
function navigate(page){
  $$".page").forEach(p=>p.classList.toggle("active",p.id===page));
  $$".nav").forEach(n=>n.classList.toggle("active",n.dataset.page===page));
  const names={dashboard:"Dashboard",tasks:"My Tasks",feedback:"Submit Feedback",history:"Feedback History"};
  $("#page-title").textContent=names[page]||"Dashboard";
  if(page==="history") loadFeedback();
  if(page==="tasks") loadTasks();
}
$$".nav").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.page));
$$"[data-go]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.go));

// Theme management
const THEME_KEY = 'quicktask-theme';
const themeToggle = $('#theme-toggle');
const html = document.documentElement;

function getInitialTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored) return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  html.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
  const current = html.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
}

// Initialize theme on load
applyTheme(getInitialTheme());

// Listen for system theme changes (only if user hasn't set a preference)
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (!localStorage.getItem(THEME_KEY)) {
    applyTheme(e.matches ? 'dark' : 'light');
  }
});

// Toggle button click
themeToggle.addEventListener('click', toggleTheme);

function taskHTML(task){
  return `<div class="task-row ${task.completed?'done':''}">
    <input class="task-check" type="checkbox" ${task.completed?'checked':''} aria-label="Mark task complete" data-toggle="${task.id}">
    <span class="task-name">${escapeHTML(task.title)}</span>
    <button class="delete-task" data-delete="${task.id}" aria-label="Delete task">×</button>
  </div>`;
}
function escapeHTML(value){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","&quot;":"&quot;","'":"&#39;"}[c]));
}
async function loadTasks(){
  try{
    const data=await api("/api/tasks");
    $("#total-tasks").textContent=data.total;
    $("#completed-tasks").textContent=data.completed;
    $("#pending-tasks").textContent=data.pending;
    $("#task-count").textContent=`${data.total} tasks`;
    $("#dashboard-tasks").innerHTML = data.tasks.map(taskHTML).join('');
    $$".task-check").forEach(c=>c.addEventListener("change",()=>toggleTask(c.dataset.toggle));
    $$".delete-task").forEach(b=>b.addEventListener("click",()=>deleteTask(b.dataset.delete));
  }catch(e){toast("Failed to load tasks");}
}
async function toggleTask(id){
  try{
    await api(`/api/tasks/${id}`,{method:"PATCH",body:JSON.stringify({completed:true})});
    loadTasks();
  }catch(e){toast("Failed to update task");}
}
async function deleteTask(id){
  try{
    await api(`/api/tasks/${id}`,{method:"DELETE"});
    loadTasks();
  }catch(e){toast("Failed to delete task");}
}
async function loadFeedback(){
  try{
    const data=await api("/api/feedback");
    $("#feedback-count").textContent=data.total||data.length;
    const list=$("#feedback-list");
    list.innerHTML=data.map(f=>`<div class="feedback-item"><strong>${escapeHTML(f.title)}</strong><p>${escapeHTML(f.description)}</p><small>${f.category} · ${f.rating}/5</small></div>`).join('');
  }catch(e){toast("Failed to load feedback");}
}
async function submitFeedback(e){
  e.preventDefault();
  try{
    await api("/api/feedback",{method:"POST",body:JSON.stringify({
      name:$("#fb-name").value,
      email:$("#fb-email").value,
      category:$("#fb-category").value,
      title:$("#fb-title").value,
      description:$("#fb-description").value,
      rating:parseInt($("#fb-rating").value,10)
    })});
    toast("Feedback submitted");
    e.target.reset();
    navigate("history");
  }catch(err){toast(err.message);}
}
$("#feedback-form").addEventListener("submit",submitFeedback);
navigate("dashboard");